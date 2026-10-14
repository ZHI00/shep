//! Path helpers shared by the backend.

use std::path::{Path, PathBuf};

/// Canonicalize a path, then drop Windows' verbatim prefix.
///
/// `std::fs::canonicalize` returns extended-length paths on Windows
/// (`\\?\D:\code\foo`). cmd.exe refuses to start in one — it prints "UNC paths
/// are not supported" and silently falls back to the Windows directory — so any
/// path we persist or hand to a shell has to be simplified first.
pub fn canonicalize(path: impl AsRef<Path>) -> std::io::Result<PathBuf> {
    std::fs::canonicalize(path).map(simplified)
}

/// Drop the verbatim prefix from an already-canonical path. No-op off Windows,
/// and a no-op for verbatim paths that have no plain equivalent (device paths
/// such as `\\?\Volume{…}`).
pub fn simplified(path: PathBuf) -> PathBuf {
    if !cfg!(windows) {
        // A leading `\\?\` is a legal (if odd) file name on unix.
        return path;
    }
    match path.to_str().and_then(strip_verbatim_prefix) {
        Some(simplified) => PathBuf::from(simplified),
        None => path,
    }
}

/// The string half of [`simplified`], compiled on every platform so it stays
/// unit-testable from a mac or Linux build.
fn strip_verbatim_prefix(text: &str) -> Option<String> {
    if let Some(rest) = text.strip_prefix(r"\\?\UNC\") {
        // \\?\UNC\server\share -> \\server\share
        return Some(format!(r"\\{rest}"));
    }

    let rest = text.strip_prefix(r"\\?\")?;
    // Only drive paths shorten safely. Long paths get shortened too: they are
    // unusable as a shell's working directory in either form, and Windows 10+
    // resolves them when long path support is on.
    let bytes = rest.as_bytes();
    let is_drive_path = bytes.len() >= 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':';
    is_drive_path.then(|| rest.to_string())
}

#[cfg(test)]
mod tests {
    use super::strip_verbatim_prefix;

    #[test]
    fn strips_verbatim_drive_paths() {
        assert_eq!(
            strip_verbatim_prefix(r"\\?\D:\code\油猴脚本").as_deref(),
            Some(r"D:\code\油猴脚本")
        );
        assert_eq!(strip_verbatim_prefix(r"\\?\C:\").as_deref(), Some(r"C:\"));
    }

    #[test]
    fn rewrites_verbatim_unc_paths() {
        assert_eq!(
            strip_verbatim_prefix(r"\\?\UNC\server\share\dir").as_deref(),
            Some(r"\\server\share\dir")
        );
    }

    #[test]
    fn leaves_other_paths_alone() {
        assert_eq!(strip_verbatim_prefix(r"D:\code\foo"), None);
        assert_eq!(strip_verbatim_prefix(r"\\server\share"), None);
        assert_eq!(strip_verbatim_prefix(r"\\?\Volume{deadbeef}\foo"), None);
        assert_eq!(strip_verbatim_prefix("/Users/me/code"), None);
    }
}
