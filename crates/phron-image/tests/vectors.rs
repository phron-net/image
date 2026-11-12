//! Runs `conformance/vectors.json`, the cases every language binding must reproduce.

use phron_image::{
    ApiParams, InfoParams, PublicParams, SignParams, Target, api_url, info_url, options,
    public_url, sign_url,
};
use serde_json::Value;

fn vectors() -> Value {
    let text = std::fs::read_to_string(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../conformance/vectors.json"
    ))
    .expect("conformance/vectors.json");
    serde_json::from_str(&text).expect("valid JSON")
}

fn s(v: &Value, k: &str) -> Option<String> {
    v.get(k).and_then(Value::as_str).map(str::to_string)
}

fn list(v: &Value, k: &str) -> Vec<String> {
    v.get(k)
        .and_then(Value::as_array)
        .map(|a| {
            a.iter()
                .filter_map(|x| x.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default()
}

fn target(v: &Value) -> Target {
    Target {
        base_url: s(v, "baseUrl"),
        label: s(v, "label"),
    }
}

fn sign_params(v: &Value, key: &str, salt: &str) -> SignParams {
    SignParams {
        target: target(v),
        key: s(v, "key").unwrap_or_else(|| key.to_string()),
        salt: s(v, "salt").unwrap_or_else(|| salt.to_string()),
        options: list(v, "options"),
        path: s(v, "path").unwrap_or_default(),
        format: s(v, "format"),
        expires_at: v.get("expiresAt").and_then(Value::as_i64),
    }
}

fn public_params(v: &Value) -> PublicParams {
    PublicParams {
        target: target(v),
        preset: s(v, "preset").unwrap_or_default(),
        width: v.get("width").and_then(Value::as_u64).map(|w| w as u32),
        path: s(v, "path").unwrap_or_default(),
        format: s(v, "format"),
    }
}

fn api_params(v: &Value) -> ApiParams {
    ApiParams {
        label: s(v, "label").unwrap_or_default(),
        api_base_url: s(v, "apiBaseUrl"),
        options: list(v, "options"),
        path: s(v, "path").unwrap_or_default(),
        format: s(v, "format"),
    }
}

#[test]
fn sign_vectors() {
    let v = vectors();
    let (key, salt) = (s(&v, "key").unwrap(), s(&v, "salt").unwrap());
    for case in v["sign"].as_array().unwrap() {
        let got = sign_url(&sign_params(case, &key, &salt)).unwrap();
        assert_eq!(got, s(case, "url").unwrap(), "{}", s(case, "name").unwrap());
    }
}

#[test]
fn public_api_info_vectors() {
    let v = vectors();
    for case in v["public"].as_array().unwrap() {
        assert_eq!(
            public_url(&public_params(case)).unwrap(),
            s(case, "url").unwrap()
        );
    }
    for case in v["api"].as_array().unwrap() {
        assert_eq!(api_url(&api_params(case)).unwrap(), s(case, "url").unwrap());
    }
    for case in v["info"].as_array().unwrap() {
        let p = InfoParams {
            label: s(case, "label").unwrap(),
            api_base_url: s(case, "apiBaseUrl"),
            options: list(case, "options"),
            path: s(case, "path").unwrap(),
        };
        assert_eq!(info_url(&p).unwrap(), s(case, "url").unwrap());
    }
}

#[test]
fn error_vectors() {
    let v = vectors();
    let (key, salt) = (s(&v, "key").unwrap(), s(&v, "salt").unwrap());
    for case in v["errors"].as_array().unwrap() {
        let name = s(case, "name").unwrap();
        let result = match s(case, "kind").unwrap().as_str() {
            "sign" => sign_url(&sign_params(case, &key, &salt)),
            "public" => public_url(&public_params(case)),
            "api" => api_url(&api_params(case)),
            other => panic!("unknown kind {other}"),
        };
        assert!(result.is_err(), "{name} should fail");
    }
}

fn call_option(case: &Value) -> Result<String, phron_image::Error> {
    let args = case["args"].as_array().unwrap();
    let text = |i: usize| args[i].as_str().unwrap().to_string();
    let int = |i: usize| args[i].as_i64();
    // A negative or fractional number is not a u32: reject it the way the binding does.
    let uint = |i: usize| {
        args[i]
            .as_u64()
            .and_then(|n| u32::try_from(n).ok())
            .ok_or_else(|| phron_image::Error::Invalid("not an unsigned integer".into()))
    };
    match case["call"].as_str().unwrap() {
        "resize" => options::resize(&text(0), uint(1)?, uint(2)?),
        "width" => Ok(options::width(uint(0)?)),
        "height" => Ok(options::height(uint(0)?)),
        "quality" => options::quality(uint(0)?),
        "format" => Ok(options::format(&text(0))),
        "gravity" => {
            let offsets =
                (args.len() == 3).then(|| (int(1).unwrap() as i32, int(2).unwrap() as i32));
            options::gravity(&text(0), offsets)
        }
        "preset" => Ok(options::preset(&text(0))),
        "expires" => Ok(options::expires(args[0].as_u64().unwrap())),
        "raw" => Ok(options::raw(&text(0))),
        other => panic!("unknown option helper {other}"),
    }
}

#[test]
fn option_vectors() {
    let v = vectors();
    for case in v["options"].as_array().unwrap() {
        assert_eq!(call_option(case).unwrap(), s(case, "out").unwrap());
    }
    for case in v["optionErrors"].as_array().unwrap() {
        assert!(call_option(case).is_err(), "{case}");
    }
    for case in v["roundedExpiry"].as_array().unwrap() {
        let got = options::rounded_expiry(
            case["nowSeconds"].as_u64().unwrap(),
            case["ttl"].as_u64().unwrap(),
            case["bucket"].as_u64().unwrap(),
        )
        .unwrap();
        assert_eq!(got, case["out"].as_u64().unwrap());
    }
}
