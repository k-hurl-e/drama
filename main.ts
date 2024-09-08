import { App, Plugin, TFolder, TFile, Notice, PluginSettingTab, Setting, Editor } from 'obsidian';

export default class DramaPlugin extends Plugin {
	writingFolder: string | null = null;

	async onload() {
		// Load settings
		await this.loadSettings();

		// Register plugin settings (for specifying Writing Folder)
		this.addSettingTab(new DramaSettingTab(this.app, this));

		// Register commands for applying styles
		this.addCommand({
			id: "apply-character-style",
			name: "Apply Character Style",
			editorCallback: (editor: Editor) => this.applyCharacterStyle(editor),
			hotkeys: [{ modifiers: ["Mod"], key: "1" }],
		});

		this.addCommand({
			id: "apply-dialogue-style",
			name: "Apply Dialogue Style",
			editorCallback: (editor: Editor) => this.applyDialogueStyle(editor),
			hotkeys: [{ modifiers: ["Mod"], key: "2" }],
		});

		this.addCommand({
			id: "apply-stage-direction-style",
			name: "Apply Stage Direction Style",
			editorCallback: (editor: Editor) => this.applyStageDirectionStyle(editor),
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

	// Apply Character Style (bold + all caps to the current line only)
	applyCharacterStyle(editor: Editor) {
		const { text, start, end } = this.getLineAtCursor(editor);
		const formattedText = `**${text.toUpperCase()}**`;
		this.replaceLine(editor, start, end, formattedText);
	}

	// Apply Dialogue Style (plain text, remove formatting from the current line)
	applyDialogueStyle(editor: Editor) {
		const { text, start, end } = this.getLineAtCursor(editor);
		this.replaceLine(editor, start, end, text); // No formatting applied
	}

	// Apply Stage Direction Style (italic to the current line only)
	applyStageDirectionStyle(editor: Editor) {
		const { text, start, end } = this.getLineAtCursor(editor);
		const formattedText = `*${text}*`;
		this.replaceLine(editor, start, end, formattedText);
	}

	// Function to identify the Writing Folder
	isWritingFolder(folder: TFolder): boolean {
		// Treat root as the Writing Folder if none is specified
		if (!this.writingFolder) {
			return folder.path === "/";
		}
		return folder.path === this.writingFolder;
	}

	// Function to check if a folder is a direct subfolder of the Writing Folder (i.e., a Project Folder)
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
		// Find the next available version number
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
		// Find the next available scene number
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
