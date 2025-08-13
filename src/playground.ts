import * as vscode from 'vscode';
import * as vm from 'vm';
import * as fs from 'fs';

export class PlaygroundExecutor {
    private context: vscode.ExtensionContext;
    private outputChannel: vscode.OutputChannel;
    private currentPlayground: any = null;
    private disposables: vscode.Disposable[] = [];

    constructor(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel) {
        this.context = context;
        this.outputChannel = outputChannel;
    }

    async execute(playgroundFilePath: string): Promise<void> {
        this.stop();
        
        this.outputChannel.clear();
        this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Executing playground: ${playgroundFilePath}`);
        
        try {
            const code = fs.readFileSync(playgroundFilePath, 'utf8');
            
            // Transform ESM imports to CommonJS for VM context
            const transformedCode = this.transformESMToCommonJS(code);
            
            // Create a new context with VS Code API and Node.js globals
            const playground = this.createPlaygroundContext();
            
            // Create VM context
            const context = vm.createContext(playground);
            
            // Execute the code
            const script = new vm.Script(transformedCode, {
                filename: playgroundFilePath,
                lineOffset: 0,
                columnOffset: 0
            });
            
            const result = script.runInContext(context, {
                timeout: 30000, // 30 second timeout
                breakOnSigint: true
            });
            
            this.currentPlayground = playground;
            
            // Handle exported functions
            if (playground.exports) {
                this.outputChannel.appendLine('Exported functions available:');
                Object.keys(playground.exports).forEach(key => {
                    this.outputChannel.appendLine(`  - ${key}`);
                });
            }
            
            this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Playground executed successfully`);
            
        } catch (error: any) {
            this.outputChannel.appendLine(`[${new Date().toLocaleTimeString()}] Playground execution failed:`);
            this.outputChannel.appendLine(error.stack || error.message || String(error));
            
            // Show error in VS Code
            const errorMessage = error.message || String(error);
            vscode.window.showErrorMessage(`Playground Error: ${errorMessage}`);
        }
    }

    private transformESMToCommonJS(code: string): string {
        // Basic transformation from ESM to CommonJS for VM execution
        let transformed = code;
        
        // Transform import statements
        transformed = transformed.replace(
            /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
            'const $1 = require("$2")'
        );
        
        transformed = transformed.replace(
            /import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"]/g,
            'const {$1} = require("$2")'
        );
        
        transformed = transformed.replace(
            /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g,
            'const $1 = require("$2").default || require("$2")'
        );
        
        // Transform export statements
        transformed = transformed.replace(
            /export\s+function\s+(\w+)/g,
            'exports.$1 = function'
        );
        
        transformed = transformed.replace(
            /export\s+{([^}]+)}/g,
            (match, exports) => {
                const exportList = exports.split(',').map((e: string) => {
                    const trimmed = e.trim();
                    return `exports.${trimmed} = ${trimmed}`;
                }).join(';\n');
                return exportList;
            }
        );
        
        transformed = transformed.replace(
            /export\s+const\s+(\w+)/g,
            'const $1 = exports.$1'
        );
        
        return transformed;
    }

    private createPlaygroundContext(): any {
        const self = this;
        
        // Create a proxied console that outputs to our output channel
        const playgroundConsole = {
            log: (...args: any[]) => {
                const message = args.map(arg => this.stringify(arg)).join(' ');
                self.outputChannel.appendLine(message);
            },
            error: (...args: any[]) => {
                const message = args.map(arg => this.stringify(arg)).join(' ');
                self.outputChannel.appendLine(`[ERROR] ${message}`);
            },
            warn: (...args: any[]) => {
                const message = args.map(arg => this.stringify(arg)).join(' ');
                self.outputChannel.appendLine(`[WARN] ${message}`);
            },
            info: (...args: any[]) => {
                const message = args.map(arg => this.stringify(arg)).join(' ');
                self.outputChannel.appendLine(`[INFO] ${message}`);
            },
            debug: (...args: any[]) => {
                const message = args.map(arg => this.stringify(arg)).join(' ');
                self.outputChannel.appendLine(`[DEBUG] ${message}`);
            }
        };
        
        // Track disposables created in playground
        const trackedDisposables: vscode.Disposable[] = [];
        const trackDisposable = (disposable: vscode.Disposable) => {
            if (disposable && typeof disposable.dispose === 'function') {
                trackedDisposables.push(disposable);
                self.disposables.push(disposable);
            }
            return disposable;
        };
        
        // Wrap vscode.commands.registerCommand to track disposables
        const originalRegisterCommand = vscode.commands.registerCommand;
        const wrappedRegisterCommand = (command: string, callback: (...args: any[]) => any) => {
            const disposable = originalRegisterCommand(command, callback);
            return trackDisposable(disposable);
        };
        
        // Create the playground context
        const playground = {
            // Node.js globals
            console: playgroundConsole,
            require: (module: string) => {
                if (module === 'vscode') {
                    // Return a proxied vscode object that tracks disposables
                    return new Proxy(vscode, {
                        get(target: any, prop: string) {
                            if (prop === 'commands') {
                                return new Proxy(target.commands, {
                                    get(cmdTarget: any, cmdProp: string) {
                                        if (cmdProp === 'registerCommand') {
                                            return wrappedRegisterCommand;
                                        }
                                        return cmdTarget[cmdProp];
                                    }
                                });
                            }
                            return target[prop];
                        }
                    });
                }
                // Just allow all modules - this is a developer tool for local use
                return require(module);
            },
            
            // Global functions
            setTimeout: (callback: any, ms: number) => {
                return setTimeout(callback, ms);
            },
            clearTimeout,
            setInterval: (callback: any, ms: number) => {
                return setInterval(callback, ms);
            },
            clearInterval,
            
            // Playground-specific
            exports: {},
            __dirname: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
            __filename: '',
            
            // Add Promise and async support
            Promise: Promise,
            process: process,
            Buffer: Buffer,
            global: {} as any
        };
        
        // Add reference to global itself
        playground.global = playground;
        
        return playground;
    }

    private stringify(obj: any): string {
        try {
            if (obj === null) return 'null';
            if (obj === undefined) return 'undefined';
            if (typeof obj === 'string') return obj;
            if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
            if (typeof obj === 'function') return obj.toString();
            if (obj instanceof Error) return obj.stack || obj.message;
            return JSON.stringify(obj, null, 2);
        } catch {
            return String(obj);
        }
    }

    stop(): void {
        // Dispose all tracked disposables
        this.disposables.forEach(d => {
            try {
                d.dispose();
            } catch (error) {
                console.error('Error disposing resource:', error);
            }
        });
        this.disposables = [];
        
        // Call deactivate if it exists
        if (this.currentPlayground?.exports?.deactivate) {
            try {
                this.currentPlayground.exports.deactivate();
            } catch (error) {
                console.error('Error calling deactivate:', error);
            }
        }
        
        this.currentPlayground = null;
    }
}