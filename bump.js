const fs = require('fs');
const path = require('path');

/**
 * KlassKit Version Bumper
 * Usage: node bump.js 1.2.3
 */

const newVersion = process.argv[2];
if (!newVersion) {
    console.error('❌ Please provide a version number (e.g. node bump.js 1.2.3)');
    process.exit(1);
}

// Basic semver validation (simple check)
if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
    console.error('❌ Invalid version format. Use x.y.z');
    process.exit(1);
}

const today = new Date().toISOString().split('T')[0];
const root = process.cwd();

// 1. Update games.json
const gamesPath = path.join(root, 'games.json');
if (fs.existsSync(gamesPath)) {
    try {
        const games = JSON.parse(fs.readFileSync(gamesPath, 'utf8'));
        const oldVersion = games.version;
        games.version = newVersion;
        games.lastUpdated = today;
        if (Array.isArray(games.games)) {
            games.metadata.totalGames = games.games.filter(g => g.category !== 'under-construction').length;
        }
        fs.writeFileSync(gamesPath, JSON.stringify(games, null, 2) + '\n', 'utf8');
        console.log(`✅ games.json: ${oldVersion} -> ${newVersion}`);
    } catch (e) {
        console.error('❌ Error updating games.json:', e.message);
    }
}

// 2. Update README.md
const readmePath = path.join(root, 'README.md');
if (fs.existsSync(readmePath)) {
    try {
        let readme = fs.readFileSync(readmePath, 'utf8');
        // Matches shields.io badge: version-1.2.2-blue
        let updatedReadme = readme.replace(/(version-)(\d+\.\d+\.\d+)(-blue)/g, `$1${newVersion}$3`);
        // Matches footer: *Current Version: 1.2.2 — Active Development.*
        updatedReadme = updatedReadme.replace(/(\*Current Version:\s*)(\d+\.\d+\.\d+)(.*\*)/g, `$1${newVersion}$3`);
        if (readme !== updatedReadme) {
            fs.writeFileSync(readmePath, updatedReadme, 'utf8');
            console.log(`✅ README.md: Version updated to ${newVersion}`);
        } else {
            console.warn('⚠️ README.md: Version not found or already updated.');
        }
    } catch (e) {
        console.error('❌ Error updating README.md:', e.message);
    }
}

// 3. Update sw.js
const swPath = path.join(root, 'sw.js');
if (fs.existsSync(swPath)) {
    try {
        let sw = fs.readFileSync(swPath, 'utf8');
        // Matches: const CACHE_NAME = 'klasskit-v1.2.2';
        const updatedSw = sw.replace(/(CACHE_NAME\s*=\s*['"]klasskit-v)(\d+\.\d+\.\d+)(['"])/g, `$1${newVersion}$3`);
        if (sw !== updatedSw) {
            fs.writeFileSync(swPath, updatedSw, 'utf8');
            console.log(`✅ sw.js: CACHE_NAME updated to v${newVersion}`);
        } else {
            console.warn('⚠️ sw.js: CACHE_NAME constant not found or already updated.');
        }
    } catch (e) {
        console.error('❌ Error updating sw.js:', e.message);
    }
}

// 4. Update package.json
const pkgPath = path.join(root, 'package.json');
if (fs.existsSync(pkgPath)) {
    try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const oldVersion = pkg.version;
        pkg.version = newVersion;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
        console.log(`✅ package.json: ${oldVersion} -> ${newVersion}`);
    } catch (e) {
        console.error('❌ Error updating package.json:', e.message);
    }
}

console.log(`\n🚀 KlassKit is now v${newVersion}!`);
