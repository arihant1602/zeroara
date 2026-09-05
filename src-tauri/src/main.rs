// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    {
        // On Linux Wayland sessions, WebKitGTK can crash with
        // "Error 71 (Protocol error) dispatching to Wayland display"
        // due to compositor DMA-BUF/subsurface mismatches.
        // Fall back to x11 via XWayland and disable DMA-BUF renderer unless explicitly overridden.
        if std::env::var("GDK_BACKEND").is_err() {
            std::env::set_var("GDK_BACKEND", "x11");
        }
        if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    zeroara_lib::run()
}
