# 本地签名（消除反复出现的系统权限弹窗）

## 为什么需要它

Shep 是终端管理器：`src-tauri/src/pty/session.rs` 把你的 shell 作为子进程拉起来。macOS 的 TCC
按「负责进程」归因权限，子进程继承父进程身份 —— 所以终端里跑的 `claude`、`find`、`rg` 一旦碰到
受保护位置（桌面、文档、下载、照片图库、通讯录），系统弹的是「**shep** 想要访问…」。这与
iTerm2、Terminal 的行为一致，不是缺陷。

真正的痛点是**反复**弹。TCC 靠 code requirement 记住「这个应用已授权」。ad-hoc 签名的应用没有
稳定的签名标识，TCC 只能拿 cdhash（二进制哈希）当身份：

```
designated => cdhash H"530fc6868766854633f01ac2aff604ba1b365d21"
```

每次 `cargo build`，二进制变 → cdhash 变 → 之前所有授权作废 → 全部重新弹一遍。

用本地自签名证书签名后，DR 变成：

```
designated => identifier "com.shep.terminal" and certificate root = H"73fd100c…"
```

bundle identifier 和证书根都不随重新构建而变化，授权因此得以保留。附带收益：
`Entitlements.plist` 只有在存在签名身份时才会被 Tauri 应用，ad-hoc 构建里它是完全失效的。

> 本地签名**不解决 Gatekeeper**。`spctl -a` 对自签名应用依然返回 `rejected`，分发给别人仍需按
> `INSTALL-UNSIGNED.md` 手动放行 —— 对方的机器不信任这张自签名根证书。免除放行需要
> Apple Developer ID（99 美元/年）+ 公证。本地构建产物没有 quarantine 标记，因此自己用不受拦。

## 一次性配置

### 1. 生成自签名代码签名证书

```bash
mkdir -p ~/.shep-signing && cd ~/.shep-signing
openssl req -x509 -newkey rsa:2048 -sha256 -days 7300 -nodes \
  -keyout shep-signing.key -out shep-signing.crt \
  -subj "/CN=Shep Local Signing/O=Shep Local/C=CN" \
  -addext "basicConstraints=critical,CA:false" \
  -addext "keyUsage=critical,digitalSignature" \
  -addext "extendedKeyUsage=critical,codeSigning"
chmod 600 ~/.shep-signing/*
```

`extendedKeyUsage=codeSigning` 是必须的，否则 `codesign` 不认这张证书。

### 2. 导入登录钥匙串

```bash
cd ~/.shep-signing
openssl pkcs12 -export -inkey shep-signing.key -in shep-signing.crt \
  -out shep-signing.p12 -name "Shep Local Signing" \
  -keypbe PBE-SHA1-3DES -certpbe PBE-SHA1-3DES -macalg sha1 \
  -passout pass:shep

security import shep-signing.p12 -k ~/Library/Keychains/login.keychain-db \
  -P shep -A -T /usr/bin/codesign -T /usr/bin/security
```

`-keypbe/-certpbe/-macalg` 指定旧算法是为了兼容 macOS 的 `security import`；OpenSSL 3 默认的
AES-256 加密 p12 会导入失败。

### 3. 信任该根证书

不做这步，`security find-identity -v -p codesigning` 会因 `CSSMERR_TP_NOT_TRUSTED` 返回
`0 valid identities`，Tauri bundler 找不到签名身份。

```bash
security add-trusted-cert -r trustRoot -p codeSign ~/.shep-signing/shep-signing.crt
```

会弹出授权对话框，输密码后点「更新设置」。验证：

```bash
security find-identity -v -p codesigning   # 应显示 1 valid identities found
```

### 4. 授权 codesign 使用私钥

新导入的密钥其 partition list 不含 `codesign`，否则每次签名都弹窗，超时则签名失败并报
`errSecInternalComponent`。两种解法：

- **首次签名时**在弹窗点「**始终允许**」（不是「允许」—— 后者只放行一次）
- 或一次性写入 partition list：

  ```bash
  security set-key-partition-list -S apple-tool:,apple:,codesign: \
    -s -k "<登录密码>" ~/Library/Keychains/login.keychain-db
  ```

### 5. 配置已在仓库中

`src-tauri/tauri.conf.json`：

```json
"macOS": {
  "entitlements": "./Entitlements.plist",
  "signingIdentity": "Shep Local Signing"
}
```

## 验证签名

```bash
codesign -dvvv /Applications/shep.app 2>&1 | grep -E "Signature|Authority|flags"
codesign -d -r- /Applications/shep.app 2>&1 | grep designated
```

期望结果：

| 字段 | ad-hoc（坏） | 已签名（好） |
| --- | --- | --- |
| `flags` | `0x20002(adhoc,linker-signed)` | `0x10000(runtime)` |
| `Authority` | 无 | `Shep Local Signing` |
| `Identifier` | `shep-<随机hash>` | `com.shep.terminal` |
| `Info.plist` | `not bound` | `entries=16` |
| `Sealed Resources` | `none` | `version=2 rules=13` |
| DR | `cdhash H"…"` | `identifier … and certificate root = H"…"` |

Tauri 在签名时会自动附加 hardened runtime（`flags=0x10000`），比手动 `codesign` 默认的
`0x0(none)` 更严格 —— 它会启用 library validation。实测 Shep 在 hardened runtime 下正常启动、
PTY 与终端功能不受影响，因为它只链接系统库和静态 Rust 代码，不加载第三方动态库。

## ⚠️ 务必备份 p12

TCC 的授权绑定在 `certificate root` 哈希上。一旦丢失 `~/.shep-signing/shep-signing.p12`
（例如重装系统、清空钥匙串），按本文档重新生成的会是一张**全新证书、全新 root 哈希**，DR 随之
改变，所有已授予的权限会失效、需要重新授权一遍。把 p12 连同密码存到密码管理器或备份盘里，
换机时导入同一张证书即可保持授权连续。

## 安装新版后

签名身份变了，系统视其为新应用，旧的 ad-hoc TCC 记录已是死账，清掉：

```bash
tccutil reset All com.shep.terminal
```

然后建议直接授予**完全磁盘访问权限**（系统设置 → 隐私与安全性 → 完全磁盘访问权限 →
添加 `/Applications/shep.app`）。这一项覆盖所有文件类 TCC，桌面/文档/下载/照片图库一次性静音，
是 iTerm2 用户的常规做法。有了稳定签名，这次授权在后续版本中会保留。

## 已知局限：dev 模式仍会反复弹窗

`pnpm tauri dev` 运行的是 `target/debug/shep` 裸二进制，不经过 bundler，因此不会被签名，
TCC 弹窗照旧。只有 `pnpm tauri build` 产出的 `.app` 受本文档保护。

## 减少触发面

把项目放在非 TCC 保护目录（`~/dev`、`~/Projects`）而不是 `~/Documents`、`~/Desktop`、
`~/Downloads`，可以直接消除对应弹窗。
