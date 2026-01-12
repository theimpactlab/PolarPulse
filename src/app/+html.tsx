import { ScrollViewStyleReset } from 'expo-router/html';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* Mobile-first viewport with iOS-specific settings */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        {/* iOS PWA settings */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Health Tracker" />
        {/* Theme color for browser UI */}
        <meta name="theme-color" content="#0D0D0F" />
        {/* Prevent phone number detection */}
        <meta name="format-detection" content="telephone=no" />

        <ScrollViewStyleReset />

        {/* Mobile web optimized styles */}
        <style dangerouslySetInnerHTML={{ __html: mobileWebStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const mobileWebStyles = `
/* Reset and base styles */
* {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
}

html, body, #root {
  height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  background-color: #0D0D0F;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* iOS-like app container on desktop */
@media (min-width: 481px) {
  body {
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #1a1a2e 0%, #0D0D0F 50%, #16213e 100%);
    min-height: 100vh;
  }

  #root {
    width: 390px;
    height: 844px;
    max-height: 90vh;
    border-radius: 40px;
    overflow: hidden;
    box-shadow:
      0 0 0 12px #1a1a1e,
      0 0 0 14px #2a2a2e,
      0 25px 50px -12px rgba(0, 0, 0, 0.5),
      0 0 100px rgba(0, 209, 167, 0.1);
    position: relative;
  }

  /* iPhone notch simulation */
  #root::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 126px;
    height: 34px;
    background: #0D0D0F;
    border-bottom-left-radius: 20px;
    border-bottom-right-radius: 20px;
    z-index: 9999;
  }
}

/* Mobile styles - full screen */
@media (max-width: 480px) {
  #root {
    width: 100%;
    height: 100%;
    border-radius: 0;
  }
}

/* Disable text selection for app-like feel */
body {
  -webkit-user-select: none;
  user-select: none;
}

/* Allow text selection in inputs */
input, textarea {
  -webkit-user-select: auto;
  user-select: auto;
}

/* Smooth scrolling */
* {
  -webkit-overflow-scrolling: touch;
}

/* Hide scrollbars but allow scrolling */
::-webkit-scrollbar {
  display: none;
}

/* iOS safe area padding */
@supports (padding: env(safe-area-inset-top)) {
  body {
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
  }
}
`;
