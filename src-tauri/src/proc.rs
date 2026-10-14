//! Child-process helpers shared by the backend.

use std::ffi::OsStr;
use std::process::Command;

/// `CREATE_NO_WINDOW`. Windows hands every console child of a GUI app its own
/// console window, which flashes on screen for as long as the child runs —
/// visible each time we shell out to git while opening a project or starting a
/// session.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// `Command::new` that never flashes a console window on Windows. Every helper
/// process we spawn should go through here; PTY sessions are the exception,
/// they get their console from ConPTY.
pub fn command(program: impl AsRef<OsStr>) -> Command {
    #[allow(unused_mut)]
    let mut cmd = Command::new(program);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}
