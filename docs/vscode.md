# VS Code setup

The recommended integration uses the official Prettier extension together with the InterSystems ObjectScript extension. Prettier and this plugin remain local dependencies of the workspace; no global npm installation is required.

## Opening this repository in VS Code

1. Clone the repository, install its dependencies and open it:

   ```bash
   git clone https://github.com/FilippoGalli001/prettier-plugin-objectscript.git
   cd prettier-plugin-objectscript
   npm install
   code .
   ```

2. Trust the workspace when VS Code asks. Local Prettier modules and plugins are disabled in untrusted workspaces.

3. Install the recommended extensions when the workspace notification appears:

   - [Prettier - Code formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) (`esbenp.prettier-vscode`);
   - [InterSystems ObjectScript](https://marketplace.visualstudio.com/items?itemName=intersystems-community.vscode-objectscript) (`intersystems-community.vscode-objectscript`).

   They can also be installed from the terminal:

   ```bash
   code --install-extension esbenp.prettier-vscode
   code --install-extension intersystems-community.vscode-objectscript
   ```

4. Open a `.cls` file and verify that the language mode in the status bar is **ObjectScript Class**. Its VS Code language ID is `objectscript-class`.

5. Run **Format Document With... → Prettier - Code formatter**. If prompted, choose **Set as Default Formatter**.

6. Save the file. This repository already contains `.vscode/settings.json`, so format-on-save is enabled for `.cls` files.

## Enabling it in another ObjectScript workspace

1. Complete the [Installation](../README.md#installation) steps of the README: install the packages and create `.prettierrc`.

2. Install the two VS Code extensions listed above.

3. Create `.vscode/settings.json` in the ObjectScript project:

   ```json
   {
     "[objectscript-class]": {
       "editor.defaultFormatter": "esbenp.prettier-vscode",
       "editor.formatOnSave": true
     },
     "prettier.requireConfig": true
   }
   ```

4. Optionally create `.vscode/extensions.json` so collaborators receive the same recommendations:

   ```json
   {
     "recommendations": [
       "esbenp.prettier-vscode",
       "intersystems-community.vscode-objectscript"
     ]
   }
   ```

5. Reload VS Code and format a `.cls` file. The Prettier extension resolves the workspace-local `prettier` package and `prettier-plugin-objectscript` from `node_modules`.

## VS Code troubleshooting

If formatting is not available:

1. verify that the workspace is trusted;
2. run `npm install` in the workspace root;
3. verify that `.prettierrc` contains `"plugins": ["prettier-plugin-objectscript"]`;
4. check that the current language mode is `ObjectScript Class` (`objectscript-class`);
5. run **Developer: Reload Window**;
6. inspect **View → Output → Prettier** for module-resolution errors.

Setting `prettier.prettierPath` is normally unnecessary and can make the workspace less portable.
