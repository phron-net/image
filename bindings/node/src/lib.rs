//! Node.js binding for the `phron-image` core. This file only converts types: every URL rule
//! lives in the core crate, so a rule is written once for every language.

use napi::bindgen_prelude::*;
use napi_derive::napi;
use phron_image as core;

fn fail(error: core::Error) -> Error {
    Error::new(Status::InvalidArg, error.to_string())
}

/// A JavaScript number that must be a whole number.
fn whole(name: &str, n: f64) -> Result<i64> {
    if n.is_finite() && n.fract() == 0.0 && n.abs() <= 9_007_199_254_740_991.0 {
        Ok(n as i64)
    } else {
        Err(Error::new(
            Status::InvalidArg,
            format!("{name} must be an integer"),
        ))
    }
}

/// A JavaScript number that must be a whole number from 0 to `u32::MAX`.
fn unsigned(name: &str, n: f64) -> Result<u32> {
    u32::try_from(whole(name, n)?).map_err(|_| {
        Error::new(
            Status::InvalidArg,
            format!("{name} must be a non-negative integer"),
        )
    })
}

fn target(base_url: Option<String>, label: Option<String>) -> core::Target {
    core::Target { base_url, label }
}

#[napi(object)]
pub struct SignInput {
    pub base_url: Option<String>,
    pub label: Option<String>,
    pub key: String,
    pub salt: String,
    pub options: Option<Vec<String>>,
    pub path: String,
    pub format: Option<String>,
    pub expires_at: Option<f64>,
}

/// Build a signed browser URL. Server-side only: `key` and `salt` must never reach a browser.
#[napi]
pub fn sign_url(input: SignInput) -> Result<String> {
    let expires_at = input
        .expires_at
        .map(|at| whole("expiresAt", at))
        .transpose()?;
    core::sign_url(&core::SignParams {
        target: target(input.base_url, input.label),
        key: input.key,
        salt: input.salt,
        options: input.options.unwrap_or_default(),
        path: input.path,
        format: input.format,
        expires_at,
    })
    .map_err(fail)
}

#[napi(object)]
pub struct PublicInput {
    pub base_url: Option<String>,
    pub label: Option<String>,
    pub preset: String,
    pub width: Option<f64>,
    pub path: String,
    pub format: Option<String>,
}

/// Build an unsigned browser URL for a source whose access is public.
#[napi]
pub fn public_url(input: PublicInput) -> Result<String> {
    let width = input.width.map(|w| unsigned("width", w)).transpose()?;
    core::public_url(&core::PublicParams {
        target: target(input.base_url, input.label),
        preset: input.preset,
        width,
        path: input.path,
        format: input.format,
    })
    .map_err(fail)
}

#[napi(object)]
pub struct ApiInput {
    pub label: String,
    pub api_base_url: Option<String>,
    pub options: Option<Vec<String>>,
    pub path: String,
    pub format: Option<String>,
}

/// Build an API URL (`/v1/image/<label>/_/...`), sent with a bearer API key.
#[napi]
pub fn api_url(input: ApiInput) -> Result<String> {
    core::api_url(&core::ApiParams {
        label: input.label,
        api_base_url: input.api_base_url,
        options: input.options.unwrap_or_default(),
        path: input.path,
        format: input.format,
    })
    .map_err(fail)
}

#[napi(object)]
pub struct InfoInput {
    pub label: String,
    pub api_base_url: Option<String>,
    pub options: Option<Vec<String>>,
    pub path: String,
}

/// Build an info URL (`/v1/image/<label>/info/...`).
#[napi]
pub fn info_url(input: InfoInput) -> Result<String> {
    core::info_url(&core::InfoParams {
        label: input.label,
        api_base_url: input.api_base_url,
        options: input.options.unwrap_or_default(),
        path: input.path,
    })
    .map_err(fail)
}

/// Percent-encode a source path the way the URL builders do.
#[napi]
pub fn encode_path(path: String) -> String {
    core::encode_path(&path)
}

#[napi]
pub fn option_resize(kind: String, width: f64, height: f64) -> Result<String> {
    core::options::resize(
        &kind,
        unsigned("width", width)?,
        unsigned("height", height)?,
    )
    .map_err(fail)
}

#[napi]
pub fn option_width(width: f64) -> Result<String> {
    Ok(core::options::width(unsigned("width", width)?))
}

#[napi]
pub fn option_height(height: f64) -> Result<String> {
    Ok(core::options::height(unsigned("height", height)?))
}

#[napi]
pub fn option_quality(quality: f64) -> Result<String> {
    core::options::quality(unsigned("quality", quality)?).map_err(fail)
}

#[napi]
pub fn option_format(format: String) -> String {
    core::options::format(&format)
}

#[napi]
pub fn option_gravity(
    gravity: String,
    x_offset: Option<f64>,
    y_offset: Option<f64>,
) -> Result<String> {
    let offsets = match (x_offset, y_offset) {
        (Some(x), Some(y)) => {
            let to_i32 = |name: &str, n: f64| {
                i32::try_from(whole(name, n)?)
                    .map_err(|_| Error::new(Status::InvalidArg, format!("{name} is out of range")))
            };
            Some((to_i32("xOffset", x)?, to_i32("yOffset", y)?))
        }
        _ => None,
    };
    core::options::gravity(&gravity, offsets).map_err(fail)
}

#[napi]
pub fn option_preset(name: String) -> String {
    core::options::preset(&name)
}

#[napi]
pub fn option_expires(unix_seconds: f64) -> Result<String> {
    let at = u64::try_from(whole("expires", unix_seconds)?)
        .map_err(|_| Error::new(Status::InvalidArg, "expires must be a non-negative integer"))?;
    Ok(core::options::expires(at))
}

#[napi]
pub fn option_raw(option: String) -> String {
    core::options::raw(&option)
}

/// `now + ttl`, rounded up to a multiple of `bucketSeconds`, in unix seconds.
#[napi]
pub fn rounded_expiry(now_seconds: f64, ttl_seconds: f64, bucket_seconds: f64) -> Result<f64> {
    let to_u64 = |name: &str, n: f64| {
        if n.is_finite() && n > 0.0 {
            Ok(n.ceil() as u64)
        } else {
            Err(Error::new(
                Status::InvalidArg,
                format!("{name} must be positive"),
            ))
        }
    };
    let now = whole("nowSeconds", now_seconds.floor())?.max(0) as u64;
    core::options::rounded_expiry(
        now,
        to_u64("ttlSeconds", ttl_seconds)?,
        to_u64("bucketSeconds", bucket_seconds)?,
    )
    .map(|at| at as f64)
    .map_err(fail)
}
