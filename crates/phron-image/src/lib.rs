//! Build and sign Phron Image URLs.
//!
//! This crate is the single implementation of the URL format for every language binding in this
//! repository (Node today; Python and Go later). It does no I/O and holds no state: every
//! function takes its inputs and returns a string or an [`Error`].
//!
//! The server verifies a signature as the base64url (no padding) HMAC-SHA256 of the hex-decoded
//! salt followed by the signed path exactly as sent, keyed with the hex-decoded key. The signed
//! path keeps its leading slash. `exp:<unix seconds>` is part of the signed path.
//!
//! `conformance/vectors.json` pins the output for a set of inputs; every binding runs it.

use base64::Engine as _;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;
use std::fmt;

pub mod options;

/// Default API host for API URLs.
pub const API_BASE_URL: &str = "https://api.phron.net";

/// What went wrong building a URL. Every variant is a caller mistake, never an I/O failure.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Error {
    /// A value was missing, out of range or malformed. The text names it.
    Invalid(String),
}

impl Error {
    pub(crate) fn invalid(message: impl Into<String>) -> Self {
        Self::Invalid(message.into())
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Invalid(message) => f.write_str(message),
        }
    }
}

impl std::error::Error for Error {}

pub type Result<T> = std::result::Result<T, Error>;

/// Where a browser URL points: a custom domain or a source label, never both.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Target {
    /// A custom domain or other base URL, for example `https://img.example.com`.
    pub base_url: Option<String>,
    /// A source label, which becomes `https://<label>.phronusercontent.com`.
    pub label: Option<String>,
}

/// Inputs of a signed browser URL.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SignParams {
    pub target: Target,
    /// Hex signing key, as shown once in the console. Server-side only.
    pub key: String,
    /// Hex salt, as shown once in the console. Server-side only.
    pub salt: String,
    /// Processing options, for example `["w:800", "q:80"]`.
    pub options: Vec<String>,
    /// Source path, not yet encoded.
    pub path: String,
    /// Output format, written as `@<format>`.
    pub format: Option<String>,
    /// Unix seconds. Adds an `exp:<n>` option, which is part of the signed path.
    pub expires_at: Option<i64>,
}

/// Inputs of an unsigned URL for a source whose access is public.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct PublicParams {
    pub target: Target,
    /// Preset name.
    pub preset: String,
    /// One of the source's public widths.
    pub width: Option<u32>,
    pub path: String,
    pub format: Option<String>,
}

/// Inputs of an API URL (`/v1/image/<label>/_/...`), sent with a bearer API key.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ApiParams {
    pub label: String,
    /// Override the API host (default [`API_BASE_URL`]).
    pub api_base_url: Option<String>,
    pub options: Vec<String>,
    pub path: String,
    pub format: Option<String>,
}

/// Inputs of an info URL (`/v1/image/<label>/info/...`).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct InfoParams {
    pub label: String,
    pub api_base_url: Option<String>,
    /// Info options, for example `["size:1", "format:1"]`.
    pub options: Vec<String>,
    pub path: String,
}

/// A source label: letters, digits and inner hyphens.
fn check_label(label: &str) -> Result<&str> {
    let bytes = label.as_bytes();
    let edge = |b: &u8| b.is_ascii_alphanumeric();
    let ok = !bytes.is_empty()
        && bytes.first().is_some_and(edge)
        && bytes.last().is_some_and(edge)
        && bytes
            .iter()
            .all(|b| b.is_ascii_alphanumeric() || *b == b'-');
    if ok {
        Ok(label)
    } else {
        Err(Error::invalid(format!("invalid source label: {label:?}")))
    }
}

/// The browser-facing base URL, without a trailing slash.
pub fn resolve_base_url(target: &Target) -> Result<String> {
    match (&target.base_url, &target.label) {
        (Some(_), Some(_)) => Err(Error::invalid("pass either baseUrl or label, not both")),
        (Some(base), None) => Ok(base.trim_end_matches('/').to_string()),
        (None, Some(label)) => Ok(format!(
            "https://{}.phronusercontent.com",
            check_label(label)?
        )),
        (None, None) => Err(Error::invalid("baseUrl or label is required")),
    }
}

/// Percent-encode one URL component the way JavaScript's `encodeURIComponent` does: everything
/// except `A-Z a-z 0-9 - _ . ! ~ * ' ( )` is written as `%XX` over its UTF-8 bytes.
fn encode_component(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for byte in input.bytes() {
        if byte.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&byte) {
            out.push(char::from(byte));
        } else {
            out.push_str(&format!("%{byte:02X}"));
        }
    }
    out
}

/// Percent-encode a source path: each segment is encoded, slashes are kept, leading slashes are
/// dropped. `@` is encoded too, because an unescaped `@` starts the output format.
pub fn encode_path(path: &str) -> String {
    path.trim_start_matches('/')
        .split('/')
        .map(encode_component)
        .collect::<Vec<_>>()
        .join("/")
}

/// `plain/<encoded path>[@<format>]`
fn plain_segment(path: &str, format: Option<&str>) -> String {
    match format.filter(|f| !f.is_empty()) {
        Some(format) => format!("plain/{}@{}", encode_path(path), encode_component(format)),
        None => format!("plain/{}", encode_path(path)),
    }
}

/// Join option strings and the plain segment into a path with a leading slash.
fn build_path(options: &[String], path: &str, format: Option<&str>) -> String {
    let mut segments: Vec<String> = options.iter().filter(|o| !o.is_empty()).cloned().collect();
    segments.push(plain_segment(path, format));
    format!("/{}", segments.join("/"))
}

/// Decode a hex string (the form keys and salts are shown in).
fn decode_hex(hex: &str) -> Result<Vec<u8>> {
    let bytes = hex.as_bytes();
    if !bytes.len().is_multiple_of(2) {
        return Err(Error::invalid("expected a hex string"));
    }
    let nibble = |b: u8| -> Result<u8> {
        char::from(b)
            .to_digit(16)
            .and_then(|d| u8::try_from(d).ok())
            .ok_or_else(|| Error::invalid("expected a hex string"))
    };
    bytes
        .chunks(2)
        .map(|pair| Ok((nibble(pair[0])? << 4) | nibble(pair[1])?))
        .collect()
}

/// The signed path (leading slash, as sent) for a set of params.
pub fn signed_path(params: &SignParams) -> String {
    let mut options = params.options.clone();
    if let Some(at) = params.expires_at {
        options.push(format!("exp:{at}"));
    }
    build_path(&options, &params.path, params.format.as_deref())
}

/// The signature over `signed_path`: base64url, no padding.
pub fn signature(key_hex: &str, salt_hex: &str, signed_path: &str) -> Result<String> {
    let key = decode_hex(key_hex)?;
    let salt = decode_hex(salt_hex)?;
    let mut mac =
        Hmac::<Sha256>::new_from_slice(&key).map_err(|_| Error::invalid("invalid signing key"))?;
    mac.update(&salt);
    mac.update(signed_path.as_bytes());
    Ok(URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes()))
}

/// Build a signed browser URL: `<base>/<signature>/<options>/plain/<path>[@<format>]`.
/// Server-side only: `key` and `salt` must never reach a browser.
pub fn sign_url(params: &SignParams) -> Result<String> {
    let base = resolve_base_url(&params.target)?;
    let path = signed_path(params);
    let sig = signature(&params.key, &params.salt, &path)?;
    Ok(format!("{base}/{sig}{path}"))
}

/// Build an unsigned browser URL for a public source:
/// `<base>/_/pr:<preset>[/w:<width>]/plain/<path>[@<format>]`.
pub fn public_url(params: &PublicParams) -> Result<String> {
    let base = resolve_base_url(&params.target)?;
    let mut opts = vec![format!("pr:{}", encode_component(&params.preset))];
    if let Some(width) = params.width {
        if width == 0 {
            return Err(Error::invalid("width must be a positive integer"));
        }
        opts.push(format!("w:{width}"));
    }
    Ok(format!(
        "{base}/_{}",
        build_path(&opts, &params.path, params.format.as_deref())
    ))
}

fn api_base(over: &Option<String>) -> String {
    over.as_deref()
        .unwrap_or(API_BASE_URL)
        .trim_end_matches('/')
        .to_string()
}

/// Build an API URL: `https://api.phron.net/v1/image/<label>/_/<options>/plain/<path>`.
pub fn api_url(params: &ApiParams) -> Result<String> {
    let mut segments = vec!["_".to_string()];
    segments.extend(params.options.iter().filter(|o| !o.is_empty()).cloned());
    segments.push(plain_segment(&params.path, params.format.as_deref()));
    Ok(format!(
        "{}/v1/image/{}/{}",
        api_base(&params.api_base_url),
        check_label(&params.label)?,
        segments.join("/")
    ))
}

/// Build an info URL: `https://api.phron.net/v1/image/<label>/info/<info options>/plain/<path>`.
pub fn info_url(params: &InfoParams) -> Result<String> {
    let mut segments = vec!["info".to_string()];
    segments.extend(params.options.iter().filter(|o| !o.is_empty()).cloned());
    segments.push(plain_segment(&params.path, None));
    Ok(format!(
        "{}/v1/image/{}/{}",
        api_base(&params.api_base_url),
        check_label(&params.label)?,
        segments.join("/")
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encodes_like_encode_uri_component() {
        assert_eq!(encode_path("/team@home/x y.jpg"), "team%40home/x%20y.jpg");
        assert_eq!(
            encode_path("café ☕/été.jpg"),
            "caf%C3%A9%20%E2%98%95/%C3%A9t%C3%A9.jpg"
        );
        assert_eq!(encode_path("a!~*'()-_.b"), "a!~*'()-_.b");
    }

    #[test]
    fn labels() {
        assert!(check_label("acme-1").is_ok());
        for bad in ["", "-a", "a-", "a.b/c", "a b"] {
            assert!(check_label(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn hex() {
        assert_eq!(decode_hex("00ff").unwrap(), vec![0, 255]);
        assert!(decode_hex("zz").is_err());
        assert!(decode_hex("abc").is_err());
    }
}
