# Optimized media by default

Web photos and videos now use automatic optimization for each new upload. The preview offers one checkbox, **Original file**, unchecked by default. Selecting it sends the exact original files. Sending a batch resets the choice. Documents remain unchanged; animations and already efficient media keep their quality.

Photos use the existing bounded automatic optimizer. Videos use the browser recorder with a 1280-pixel longest edge, up to 30 fps, 1.8 Mbps video and 96 kbps audio. Recording routes the selected file's audio to the encoder without microphone access or speaker playback, and provides progress and cancellation. The output is used only when smaller. Unsupported codecs, unsupported encoders, or an estimated compressed output above the 64 MiB memory budget prompt the user to select Original file. Compression runs at playback speed and may take a while for longer videos. No backend transcoding, new database migration or infrastructure is introduced.

Validation: 910 unit tests pass (one skipped), lint/format/typecheck/build pass, and all twelve browser tests pass across desktop Chromium/WebKit and phone/iPhone widths. The exact production export was used. Browser coverage includes automatic video size reduction, resolution, retained non-silent audio, playback/download and unchanged Original photo bytes. Evidence is in optimized-default-evidence/. Mobile widths are browser emulation, not physical device certification.

The synthetic two-second 1080p video fixture includes a 440 Hz tone, generated with ffmpeg testsrc2/sine, libx264 CRF 10 and AAC. It contains no user media. Browser APIs follow the vendor MediaRecorder documentation: https://webkit.org/blog/11353/mediarecorder-api/ .

Production publication swaps only the static Web release under both production locks, preserves the current public configuration and old chunks for active tabs, and restores the previous symlink if verification fails. API, database and Nginx configuration are preserved. See deploy/media-optimized-default/production-receipt.json after publication.

Published Web source: `c7faea3e2b336b17efdce41861b2cc81dc5a5939`. Public HTML, service worker, application JavaScript and stylesheet hashes match the tested export. The existing API container, public config and Nginx were preserved. GitHub CI passed: https://github.com/nahianahmed3832/meldiq-web/actions/runs/41471722466 .
