import * as vscode from 'vscode';

let fileCache: vscode.Uri[] = []; // Cache for all relevant files

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {
    // Initialize the file cache
    initializeFileCache();

    // Watch for file changes to keep the cache up-to-date
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.{c,cpp,h}');
    watcher.onDidCreate(uri => fileCache.push(uri)); // Add new files to the cache
    watcher.onDidDelete(uri => {
        fileCache = fileCache.filter(file => file.fsPath !== uri.fsPath); // Remove deleted files
    });
    watcher.onDidChange(uri => {
        // No specific action needed for changes, as we only care about existence
    });

    context.subscriptions.push(watcher);

    // Register the toggle command
    let disposable = vscode.commands.registerCommand('toggler.toggleFile', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found.');
            return;
        }

        const currentFile = editor.document.fileName;

        // Determine the target file(s) based on the current file's extension
        if (currentFile.endsWith('.cpp')) {
            const headerFile = currentFile.replace(/\.cpp$/, '.h');
            openFile(headerFile);
        } else if (currentFile.endsWith('.c')) {
            const headerFile = currentFile.replace(/\.c$/, '.h');
            openFile(headerFile);
        } else if (currentFile.endsWith('.h')) {
            const cppFile = currentFile.replace(/\.h$/, '.cpp');
            const cFile = currentFile.replace(/\.h$/, '.c');
            openFile(cppFile, cFile);
        } else {
            vscode.window.showErrorMessage('Current file is not a .c, .cpp, or .h file.');
        }
    });

    context.subscriptions.push(disposable);
}

// Initialize the file cache by scanning the workspace
async function initializeFileCache() {
    if (!vscode.workspace.workspaceFolders) {
        return; // No open workspace
    }

    try {
        // Find all .c, .cpp, and .h files in the workspace
        const uris = await vscode.workspace.findFiles('**/*.{c,cpp,h}', '**/node_modules/**');
        fileCache = uris; // Populate the cache
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to initialize file cache: ${error}`);
    }
}

// Open a file by first checking opened editors, then cache, and finally workspace-wide search
function openFile(primaryPath: string, fallbackPath?: string) {
    const primaryUri = findInOpenedEditors(primaryPath);

    if (primaryUri) {
        // Open the primary file if found in opened editors
        vscode.workspace.openTextDocument(primaryUri).then(doc => vscode.window.showTextDocument(doc));
    } else if (fallbackPath) {
        const fallbackUri = findInOpenedEditors(fallbackPath);
        if (fallbackUri) {
            // Open the fallback file if found in opened editors
            vscode.workspace.openTextDocument(fallbackUri).then(doc => vscode.window.showTextDocument(doc));
        } else {
            // If neither primary nor fallback are found in opened editors, check the cache
            openCachedFile(primaryPath, fallbackPath);
        }
    } else {
        // If no fallback provided, check the cache for the primary file
        openCachedFile(primaryPath);
    }
}

// Open a file from the cache or fallback to searching in the entire project
function openCachedFile(primaryPath: string, fallbackPath?: string) {
    const primaryUri = findInCache(primaryPath);

    if (primaryUri) {
        // Open the primary file if found in the cache
        vscode.workspace.openTextDocument(primaryUri).then(doc => vscode.window.showTextDocument(doc));
    } else if (fallbackPath) {
        const fallbackUri = findInCache(fallbackPath);
        if (fallbackUri) {
            // Open the fallback file if found in the cache
            vscode.workspace.openTextDocument(fallbackUri).then(doc => vscode.window.showTextDocument(doc));
        } else {
            // If neither primary nor fallback are found in the cache, search in the workspace as a last resort
            searchInWorkspace([primaryPath, fallbackPath]);
        }
    } else {
        // If no fallback provided, search for the primary file in the workspace as a last resort
        searchInWorkspace([primaryPath]);
    }
}

// Search for files in opened editors first
function findInOpenedEditors(filePath: string): vscode.Uri | undefined {
    const openedEditors = vscode.window.visibleTextEditors;
    
    for (const editor of openedEditors) {
        if (editor.document.fileName === filePath) {
            return editor.document.uri;
        }
    }

    return undefined; // File not found in opened editors
}

// Search for files in the workspace as a last resort
function searchInWorkspace(filePatterns: string[]) {
    Promise.all(
        filePatterns.map(pattern =>
            vscode.workspace.findFiles(`**/${pattern.split('/').pop()}`, '**/node_modules/**', 1)
        )
    ).then(results => {
        const foundFiles = results.flat();
        if (foundFiles.length > 0) {
            // Open the first matching file found
            vscode.workspace.openTextDocument(foundFiles[0]).then(doc => vscode.window.showTextDocument(doc));
        } else {
            vscode.window.showErrorMessage(`Unable to find files: ${filePatterns.join(', ')}`);
        }
    });
}

// Find a file in the cache by its path
function findInCache(filePath: string): vscode.Uri | undefined {
    return fileCache.find(uri => uri.fsPath === filePath);
}

// This method is called when your extension is deactivated
export function deactivate() {}
