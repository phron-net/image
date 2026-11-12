//! Typed helpers for the common processing options. Each returns the option as a string, so
//! they mix freely with raw strings in an options list. They stay inside the server's option
//! allow-list (`ALLOWED_OPTIONS` in the engine); anything else goes through [`raw`].

use crate::{Error, Result};

const RESIZE_TYPES: &[&str] = &["fit", "fill", "fill-down", "force", "auto"];
const GRAVITIES: &[&str] = &[
    "no", "so", "ea", "we", "noea", "nowe", "soea", "sowe", "ce", "sm",
];

/// `rs:<type>:<width>:<height>`
pub fn resize(kind: &str, width: u32, height: u32) -> Result<String> {
    if !RESIZE_TYPES.contains(&kind) {
        return Err(Error::invalid(format!("unknown resize type: {kind:?}")));
    }
    Ok(format!("rs:{kind}:{width}:{height}"))
}

/// `w:<width>`
pub fn width(width: u32) -> String {
    format!("w:{width}")
}

/// `h:<height>`
pub fn height(height: u32) -> String {
    format!("h:{height}")
}

/// `q:<quality>` (1 to 100).
pub fn quality(quality: u32) -> Result<String> {
    if !(1..=100).contains(&quality) {
        return Err(Error::invalid("quality must be an integer from 1 to 100"));
    }
    Ok(format!("q:{quality}"))
}

/// `f:<format>`. A URL can also carry the format as an `@<format>` suffix.
pub fn format(format: &str) -> String {
    format!("f:{format}")
}

/// `g:<gravity>[:<x offset>:<y offset>]`
pub fn gravity(gravity: &str, offsets: Option<(i32, i32)>) -> Result<String> {
    if !GRAVITIES.contains(&gravity) {
        return Err(Error::invalid(format!("unknown gravity: {gravity:?}")));
    }
    Ok(match offsets {
        Some((x, y)) => format!("g:{gravity}:{x}:{y}"),
        None => format!("g:{gravity}"),
    })
}

/// `pr:<preset>`
pub fn preset(name: &str) -> String {
    format!("pr:{name}")
}

/// `exp:<unix seconds>`
pub fn expires(unix_seconds: u64) -> String {
    format!("exp:{unix_seconds}")
}

/// Escape hatch: an option written exactly as it should appear in the URL.
pub fn raw(option: &str) -> String {
    option.to_string()
}

/// Round an expiry up to a bucket boundary: `now + ttl`, rounded UP to a multiple of
/// `bucket_seconds`, as a unix time in seconds.
///
/// A URL that carries the same `exp` on every render stays byte-identical, so the browser's
/// cache keeps working; "now plus one hour" changes every second and defeats it.
pub fn rounded_expiry(now_seconds: u64, ttl_seconds: u64, bucket_seconds: u64) -> Result<u64> {
    if ttl_seconds == 0 || bucket_seconds == 0 {
        return Err(Error::invalid(
            "ttlSeconds and bucketSeconds must be positive",
        ));
    }
    let target = now_seconds.saturating_add(ttl_seconds);
    Ok(target
        .div_ceil(bucket_seconds)
        .saturating_mul(bucket_seconds))
}
