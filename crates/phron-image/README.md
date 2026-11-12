# phron-image

Build and sign [Phron Image](https://phron.net) URLs. This crate is the single implementation of
the URL format behind every Phron Image SDK in
[phron-net/image](https://github.com/phron-net/image); the language packages (`@phron/image` on
npm) bind it.

```rust
use phron_image::{SignParams, Target, sign_url};

let url = sign_url(&SignParams {
    target: Target { label: Some("my-source".into()), ..Default::default() },
    key: std::env::var("PHRON_IMAGE_KEY")?,
    salt: std::env::var("PHRON_IMAGE_SALT")?,
    options: vec!["w:800".into(), "q:80".into()],
    path: "photos/my cat.jpg".into(),
    ..Default::default()
})?;
```

Keys and salts are server-side secrets: never ship them to a browser.
