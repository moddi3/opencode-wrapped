// Custom terminal image display with Ghostty, Kitty, iTerm2, and fallback support

export type TerminalType = "ghostty" | "kitty" | "iterm" | "wezterm" | "konsole" | "vscode" | "warp" | "standard";

export interface TerminalInfo {
  type: TerminalType;
  supportsKittyProtocol: boolean;
  supportsITerm2Protocol: boolean;
}

export function detectTerminal(): TerminalInfo {
  const env = process.env;

  let type: TerminalType = "standard";
  let supportsKittyProtocol = false;
  let supportsITerm2Protocol = false;

  // Ghostty - supports Kitty graphics protocol
  if (env.TERM === "xterm-ghostty") {
    type = "ghostty";
    supportsKittyProtocol = true;
    console.log("Detected Ghostty terminal.");
  }
  // Kitty
  else if (env.TERM === "xterm-kitty" || env.KITTY_WINDOW_ID) {
    type = "kitty";
    supportsKittyProtocol = true;
  }
  // WezTerm - supports both Kitty and iTerm2 protocols
  else if (env.TERM_PROGRAM === "WezTerm") {
    type = "wezterm";
    supportsKittyProtocol = true;
    supportsITerm2Protocol = true;
  }
  // iTerm2
  else if (env.TERM_PROGRAM === "iTerm.app") {
    type = "iterm";
    supportsITerm2Protocol = true;
  }
  // Konsole - supports Kitty protocol
  else if (env.TERM_PROGRAM === "konsole" || env.KONSOLE_VERSION) {
    type = "konsole";
    supportsKittyProtocol = true;
  }
  // VS Code terminal
  else if (env.TERM_PROGRAM === "vscode") {
    type = "vscode";
    supportsITerm2Protocol = true;
  } else if (env.TERM_PROGRAM === "WarpTerminal") {
    type = "warp";
    supportsKittyProtocol = true;
  }

  return {
    type,
    supportsKittyProtocol,
    supportsITerm2Protocol,
  };
}

/**
 * Display image using Kitty graphics protocol
 * https://sw.kovidgoyal.net/kitty/graphics-protocol/
 */
function displayKittyProtocol(pngBuffer: Buffer): void {
  const base64Data = pngBuffer.toString("base64");
  const chunkSize = 4096;

  for (let i = 0; i < base64Data.length; i += chunkSize) {
    const chunk = base64Data.slice(i, i + chunkSize);
    const isLast = i + chunkSize >= base64Data.length;

    if (i === 0) {
      // First chunk: a=T (transmit and display), f=100 (PNG), m=1 (more data) or m=0 (last)
      process.stdout.write(`\x1b_Ga=T,f=100,m=${isLast ? 0 : 1};${chunk}\x1b\\`);
    } else {
      // Subsequent chunks
      process.stdout.write(`\x1b_Gm=${isLast ? 0 : 1};${chunk}\x1b\\`);
    }
  }

  // Add newline after image
  process.stdout.write("\n");
}

/**
 * Display image using iTerm2 inline images protocol
 * https://iterm2.com/documentation-images.html
 */
function displayITerm2Protocol(pngBuffer: Buffer): void {
  const base64Data = pngBuffer.toString("base64");
  const filename = Buffer.from("opencode-wrapped.png").toString("base64");

  // OSC 1337 ; File=[args] : base64data ST
  process.stdout.write(`\x1b]1337;File=name=${filename};size=${pngBuffer.length};inline=1:${base64Data}\x07\n`);
}

export async function displayInTerminal(pngBuffer: Buffer): Promise<boolean> {
  const terminal = detectTerminal();

  try {
    if (terminal.supportsKittyProtocol) {
      displayKittyProtocol(pngBuffer);
      return true;
    }

    if (terminal.supportsITerm2Protocol) {
      displayITerm2Protocol(pngBuffer);
      return true;
    }

    // No native image support
    return false;
  } catch {
    return false;
  }
}

export function getTerminalName(): string {
  const terminal = detectTerminal();
  return terminal.type;
}
