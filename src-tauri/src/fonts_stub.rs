//! Non-macOS stand-in for the CoreText-backed `fonts` module.
//!
//! Font enumeration is a macOS-only nicety: with an empty family list the
//! frontend simply offers its built-in font stack, and with no face data the
//! browser falls back to synthesized variants. Same public surface as
//! `fonts.rs` so `commands.rs` compiles unchanged.

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FontFamily {
    pub family: String,
    pub face_count: usize,
    pub is_nerd_font: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FontFaceData {
    /// Raw TTF/OTF bytes read from disk.
    pub data: Vec<u8>,
    /// CSS font-weight value in the 100..=900 range.
    pub weight: u16,
    /// Whether the face is italic or oblique.
    pub italic: bool,
    /// CSS font-stretch keyword index (1 = ultra-condensed .. 9 = ultra-expanded).
    pub stretch: u16,
}

pub fn list_monospace_families() -> Vec<FontFamily> {
    Vec::new()
}

pub fn load_font_family(_family: &str) -> Vec<FontFaceData> {
    Vec::new()
}
