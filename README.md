# VS Code Playground

A VS Code extension that acts as a playground with access to the VS Code API, allowing you to dynamically modify VS Code's behavior at runtime.

## Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Press the run button in VS Code to launch a new Extension Development Host window
4. The extension will be active in the new window

## Usage

### Quick Start

1. Open a workspace/folder in VS Code
2. Run command: `Create VS Code Playground File` (Cmd/Ctrl+Shift+P)
3. Edit the generated `.vscode-playground.js` file
4. Updating the file will update (or error if invalid and log to console / output tab)

### Commands

- `Create VS Code Playground File` - Creates a new playground file with examples
- `Run VS Code Playground` - Manually execute the playground file
- `Stop VS Code Playground` - Stop the current playground and clean up resources

### Example Playground Code

```javascript
import * as vscode from 'vscode';

// Show a message
vscode.window.showInformationMessage('Hello from Playground!');

// Work with the active editor
const editor = vscode.window.activeTextEditor;
if (editor) {
    console.log(`Editing: ${editor.document.fileName}`);
}

// Cleanup when playground reloads
export function deactivate() {
    // disposable.dispose();
}
```

## Developing the Extension

You'll need to:

```bash
npm install
```

And then I'd just use VS Code play button, which will use `launch.json` in turn.

## Publishing

To package the extension for distribution:

```bash
# Install vsce (Visual Studio Code Extension manager)
npm install -g vsce

# Package the extension
vsce package
```

This creates a `.vsix` file that can be installed in VS Code.

## License

MIT# vscode-extension-playground
