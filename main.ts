import { App, Plugin, TFolder, TFile, Notice, PluginSettingTab, Setting, Editor } from 'obsidian';

export default class DramaPlugin extends Plugin {
	writingFolder: string | null = null;

	async onload() {
		// Load settings
		await this.loadSettings();

		// Register plugin settings (for specifying Writing Folder)
		this.addSettingTab(new DramaSettingTab(this.app, this));

		// Create New Version Folder
		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, folder) => {
				// Only allow "Create New Version Folder" in Project Folders
				if (folder instanceof TFolder && this.isProjectFolder(folder)) {
					menu.addItem((item) => {
						item.setTitle("Create New Version Folder")
							.setIcon("folder")
							.onClick(() => this.createNewVersionFolder(folder));
					});
				}
			})
		);
		
		// Register commands for applying styles
		this.addCommand({
			id: "apply-character-style",
			name: "Apply Character Style",
			editorCallback: (editor: Editor) => this.toggleCharacterStyle(editor),
			hotkeys: [{ modifiers: ["Mod"], key: "1" }],
		});

		this.addCommand({
			id: "apply-dialogue-style",
			name: "Apply Dialogue Style",
			editorCallback: (editor: Editor) => this.toggleDialogueStyle(editor),
			hotkeys: [{ modifiers: ["Mod"], key: "2" }],
		});

		this.addCommand({
			id: "apply-stage-direction-style",
			name: "Apply Stage Direction Style",
			editorCallback: (editor: Editor) => this.toggleStageDirectionStyle(editor),
			hotkeys: [{ modifiers: ["Mod"], key: "3" }],
		});
	}

	// Get the current line where the cursor is located
	getLineAtCursor(editor: Editor): { text: string, start: CodeMirror.Position, end: CodeMirror.Position } {
		const cursor = editor.getCursor();
		const lineText = editor.getLine(cursor.line);
		const start = { line: cursor.line, ch: 0 };
		const end = { line: cursor.line, ch: lineText.length };
		return { text: lineText, start, end };
	}

	// Replace the current line with formatted text
	replaceLine(editor: Editor, start: CodeMirror.Position, end: CodeMirror.Position, formattedText: string) {
		editor.replaceRange(formattedText, start, end);
	}

	// Remove all formatting (bold and italic) from the text
	removeFormatting(text: string): string {
		return text.replace(/[*_~`]+/g, '').trim(); // Remove markdown formatting
	}

	// Toggle Character Style (bold + all caps to the current line only)
	toggleCharacterStyle(editor: Editor) {
		const { text, start, end } = this.getLineAtCursor(editor);
		const unformattedText = this.removeFormatting(text);

		// If the text is already bold, remove the bold formatting
		if (text.startsWith('**') && text.endsWith('**')) {
			this.replaceLine(editor, start, end, unformattedText);
		} else {
			// Apply bold + all caps formatting
			const formattedText = `**${unformattedText.toUpperCase()}**`;
			this.replaceLine(editor, start, end, formattedText);
		}
	}

	// Toggle Stage Direction Style (italic to the current line only)
toggleStageDirectionStyle(editor: Editor) {
    const { text, start, end } = this.getLineAtCursor(editor);

    // First, ensure all formatting (bold and italic) is removed
    let unformattedText = this.removeFormatting(text);

    // Apply italic formatting if not already applied
    if (text.startsWith('*') && text.endsWith('*')) {
        this.replaceLine(editor, start, end, unformattedText); // Remove italics if already applied
    } else {
        // Apply italic formatting AFTER removing any previous bold (**)
        const formattedText = `*${unformattedText}*`;
        this.replaceLine(editor, start, end, formattedText);
    }
}

	// Function to identify the Writing Folder
	isWritingFolder(folder: TFolder): boolean {
		if (!this.writingFolder) {
			return folder.path === "/";
		}
		return folder.path === this.writingFolder;
	}

	// Function to check if a folder is a Project Folder (direct subfolder of Writing Folder)
	isProjectFolder(folder: TFolder): boolean {
		const parentFolder = folder.parent;
		return parentFolder && this.isWritingFolder(parentFolder);
	}

	// Function to check if a folder is a Version Folder (starts with 'v')
	isVersionFolder(folder: TFolder): boolean {
		return /^v\d{4}$/.test(folder.name);
	}

	// Create a new Version Folder (next available version number)
	async createNewVersionFolder(folder: TFolder) {
		const versionFolders = folder.children.filter(f => f instanceof TFolder && this.isVersionFolder(f));
		const nextVersionNumber = versionFolders.length + 1;
		const newVersionFolderName = `v${nextVersionNumber.toString().padStart(4, '0')}`;
		const nextVersionFolder = await this.app.vault.createFolder(`${folder.path}/${newVersionFolderName}`);

		// Create default files in the new version folder
		await this.app.vault.create(`${nextVersionFolder.path}/${newVersionFolderName}_0_title_page.md`, '# Title Page');
		await this.app.vault.create(`${nextVersionFolder.path}/${newVersionFolderName}_0_notes.md`, '# Notes');
		await this.app.vault.create(`${nextVersionFolder.path}/${newVersionFolderName}_scene0001.md`, '# Scene 1');
		new Notice(`Version ${nextVersionNumber} Created`);
	}

	// Create a new Scene in the Version Folder
	async createNewScene(folder: TFolder) {
		const sceneFiles = folder.children.filter(f => f instanceof TFile && f.name.includes('scene'));
		const nextSceneNumber = sceneFiles.length + 1;
		const newSceneFileName = `${folder.path}/v${folder.name.substring(1)}_scene${nextSceneNumber.toString().padStart(4, '0')}.md`;
		await this.app.vault.create(newSceneFileName, `# Scene ${nextSceneNumber}`);
		new Notice(`Scene ${nextSceneNumber} Created`);
	}

	// Settings: Load the Writing Folder from user settings
	async loadSettings() {
		const data = await this.loadData();
		this.writingFolder = data?.writingFolder ?? null;
	}

	// Save settings for Writing Folder
	async saveSettings(newSettings: { writingFolder: string }) {
		await this.saveData({ writingFolder: newSettings.writingFolder });
		this.writingFolder = newSettings.writingFolder;
	}
}

// Settings Tab for Obsidian Plugin Settings
class DramaSettingTab extends PluginSettingTab {
	plugin: DramaPlugin;

	constructor(app: App, plugin: DramaPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl('h2', { text: 'Drama Plugin Settings' });

		// Input for Writing Folder
		new Setting(containerEl)
			.setName('Writing Folder')
			.setDesc('Specify the folder that will act as the root for all your playwriting projects.')
			.addText(text => text
				.setPlaceholder('Enter path to Writing Folder')
				.setValue(this.plugin.writingFolder || '')
				.onChange(async (value) => {
					await this.plugin.saveSettings({ writingFolder: value.trim() });
				}));
	}
}
