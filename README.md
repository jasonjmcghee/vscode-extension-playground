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

### Example `.vscode-playground.js`

(See [./examples](./examples) for more.

```javascript
import * as vscode from 'vscode';

let statusItem;
let commands = [];

export function activate(context) {
    // Create a clickable status bar item
    statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    statusItem.text = '$(beaker) Playground';
    statusItem.tooltip = 'Click to show playground menu';
    statusItem.command = 'playground.showMenu';
    statusItem.show();
    
    // Register the menu command
    const menuCommand = vscode.commands.registerCommand('playground.showMenu', async () => {
        const items = [
            { label: '$(megaphone) Say Hello', action: 'hello' },
            { label: '$(file) Show Current File', action: 'currentFile' },
            { label: '$(symbol-method) Get Selected Text', action: 'selectedText' },
            { label: '$(gear) Show Settings', action: 'settings' }
        ];
        
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a playground action'
        });
        
        if (selected) {
            switch(selected.action) {
                case 'hello':
                    vscode.window.showInformationMessage('Hello from Playground! 🎉');
                    break;
                case 'currentFile':
                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        vscode.window.showInformationMessage(`Current file: ${editor.document.fileName}`);
                    }
                    break;
                case 'selectedText':
                    const activeEditor = vscode.window.activeTextEditor;
                    if (activeEditor) {
                        const text = activeEditor.document.getText(activeEditor.selection);
                        vscode.window.showInformationMessage(`Selected: "${text}"`);
                    }
                    break;
                case 'settings':
                    const config = vscode.workspace.getConfiguration();
                    const theme = config.get('workbench.colorTheme');
                    vscode.window.showInformationMessage(`Theme: ${theme}`);
                    break;
            }
        }
    });
    
    commands.push(menuCommand);
    context.subscriptions.push(menuCommand);
    context.subscriptions.push(statusItem);
}

export function deactivate() {
    if (statusItem) {
        statusItem.dispose();
    }
    commands.forEach(cmd => cmd.dispose());
}
```

## Developing the Extension

You'll need to:

```bash
npm install
```

And then I'd just use VS Code play button, which will use `launch.json` in turn.

You may manually compile with:

```bash
npm run compile
```

## Publishing

To package the extension for distribution:

```bash
# Install vsce (Visual Studio Code Extension manager)
npm install -g vsce

# Package the extension
vsce package
```

This creates a `.vsix` file that can be installed in VS Code.
