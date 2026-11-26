const fs = require('fs');
const path = require('path');

/**
 * KlassKit Version Bumper
 * Usage:
 *   node bump.js <x.y.z | patch | minor | major> [--dry-run]
 */

const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const root = __dirname;

function printUsage() {
    console.log('Usage: node bump.js <x.y.z | patch | minor | major> [--dry-run]');
}

function parseArgs(argv) {
    let target = null;
    let dryRun = false;

    for (const arg of argv) {
        if (arg === '--dry-run' || arg === '-n') {
            dryRun = true;
        } else if (arg === '--help' || arg === '-h') {
            printUsage();
            process.exit(0);
        } else if (!arg.startsWith('-') && !target) {
            target = arg;
        } else {
            console.error(`❌ Unknown or duplicate argument: ${arg}`);
            printUsage();
            process.exit(1);
        }
    }

    if (!target) {
        console.error('❌ Please provide a version number or bump type (patch, minor, major).');
        printUsage();
        process.exit(1);
    }

    return { target, dryRun };
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data, dryRun) {
    if (!dryRun) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
    }
}

function getLocalDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function resolveNextVersion(target) {
    if (SEMVER_RE.test(target)) {
        return target;
    }

    if (!['patch', 'minor', 'major'].includes(target)) {
        console.error('❌ Invalid version format. Use x.y.z or patch | minor | major.');
        process.exit(1);
    }

    const candidates = [path.join(root, 'games.json'), path.join(root, 'package.json')];
    let current = null;
    for (const filePath of candidates) {
        if (fs.existsSync(filePath)) {
            const data = readJson(filePath);
            if (typeof data.version === 'string' && SEMVER_RE.test(data.version)) {
                current = data.version;
                break;
            }
        }
    }

    if (!current) {
        console.error('❌ Could not determine current version from games.json or package.json.');
        process.exit(1);
    }

    const [major, minor, patch] = current.split('.').map(Number);
    if (target === 'major') return `${major + 1}.0.0`;
    if (target === 'minor') return `${major}.${minor + 1}.0`;
    return `${major}.${minor}.${patch + 1}`;
}

function updateGamesJson(newVersion, today, dryRun) {
    const gamesPath = path.join(root, 'games.json');
    if (!fs.existsSync(gamesPath)) return null;

    const games = readJson(gamesPath);
    const oldVersion = games.version;
    const counts = {
        printable: 0,
        tool: 0,
        game: 0,
        workshop: 0,
        myspace: 0,
        'under-construction': 0
    };

    let activeCount = 0;
    let totalEntries = 0;

    if (Array.isArray(games.games)) {
        totalEntries = games.games.length;
        for (const item of games.games) {
            if (item && item.category in counts) {
                counts[item.category] += 1;
            }
        }
        activeCount = totalEntries - counts['under-construction'];
        games.metadata = games.metadata || {};
        games.metadata.totalGames = activeCount;
    }

    games.version = newVersion;
    games.lastUpdated = today;
    writeJson(gamesPath, games, dryRun);
    console.log(`✅ games.json: ${oldVersion} -> ${newVersion} (active: ${activeCount}, total: ${totalEntries})`);

    return {
        counts,
        activeCount,
        wipCount: counts['under-construction'],
        totalEntries
    };
}

function updateReadme(newVersion, stats, dryRun) {
    const readmePath = path.join(root, 'README.md');
    if (!fs.existsSync(readmePath)) return;

    const readme = fs.readFileSync(readmePath, 'utf8');
    let updated = readme
        .replace(/(version-)(\d+\.\d+\.\d+)(-blue)/g, `$1${newVersion}$3`)
        .replace(/(\*Current Version:\s*)(\d+\.\d+\.\d+)(.*\*)/g, `$1${newVersion}$3`)
        .replace(/(node bump\.js\s+)(\d+\.\d+\.\d+)/g, `$1${newVersion}`);

    if (stats) {
        const replacements = [
            [/(activities-)(\d+)(%20Active-green)/g, `$1${stats.activeCount}$3`],
            [/(ecosystem of\s+)(\d+)(\s+active interactive tools, printables, and classroom games\*\*\s+\(plus\s+)(\d+)(\s+modules in active development\))/g, `$1${stats.activeCount}$3${stats.wipCount}$5`],
            [/(organizes\s+\*\*)(\d+)(\s+active modules\*\* into five core zones, plus\s+\*\*)(\d+)(\s+Work in Progress\*\* modules:)/g, `$1${stats.activeCount}$3${stats.wipCount}$5`],
            [/(Central catalog registry \()(\d+)( entries,\s+)(\d+)( active\))/g, `$1${stats.totalEntries}$3${stats.activeCount}$5`],
            [/(### 🖨️ Printables \()(\d+)(\))/g, `$1${stats.counts.printable}$3`],
            [/(### 🧰 Teaching Tools \()(\d+)(\))/g, `$1${stats.counts.tool}$3`],
            [/(### 🎮 Classroom Games \()(\d+)(\))/g, `$1${stats.counts.game}$3`],
            [/(### 🛠️ Classroom Workshop \()(\d+)(\))/g, `$1${stats.counts.workshop}$3`],
            [/(### 🏡 My Space \()(\d+)( — Pro \/ Admin\))/g, `$1${stats.counts.myspace}$3`],
            [/(### 🚧 Work in Progress \()(\d+)(\))/g, `$1${stats.wipCount}$3`],
            [/(├── printables\/[^\n]*\()(\d+)(\))/g, `$1${stats.counts.printable}$3`],
            [/(├── tools\/[^\n]*\()(\d+)(\))/g, `$1${stats.counts.tool}$3`],
            [/(├── games\/[^\n]*\()(\d+)(\))/g, `$1${stats.counts.game}$3`],
            [/(├── workshop\/[^\n]*\()(\d+)(\))/g, `$1${stats.counts.workshop}$3`],
            [/(├── my-space\/[^\n]*\()(\d+)(, Pro\/Admin\))/g, `$1${stats.counts.myspace}$3`],
            [/(└── wip\/[^\n]*\()(\d+)(\))/g, `$1${stats.wipCount}$3`]
        ];
        for (const [pattern, replacement] of replacements) {
            updated = updated.replace(pattern, replacement);
        }
    }

    if (readme !== updated) {
        if (!dryRun) fs.writeFileSync(readmePath, updated, 'utf8');
        console.log(`✅ README.md: Updated to v${newVersion}`);
    } else {
        console.log(`ℹ️ README.md: Already up to date.`);
    }
}

function updateServiceWorker(newVersion, dryRun) {
    const swPath = path.join(root, 'sw.js');
    if (!fs.existsSync(swPath)) return;

    const sw = fs.readFileSync(swPath, 'utf8');
    const updated = sw.replace(/(CACHE_NAME\s*=\s*['"]klasskit-v)(\d+\.\d+\.\d+)(['"])/g, `$1${newVersion}$3`);

    if (sw !== updated) {
        if (!dryRun) fs.writeFileSync(swPath, updated, 'utf8');
        console.log(`✅ sw.js: CACHE_NAME updated to klasskit-v${newVersion}`);
    } else if (sw.includes(`klasskit-v${newVersion}`)) {
        console.log(`ℹ️ sw.js: CACHE_NAME already at klasskit-v${newVersion}`);
    } else {
        console.warn('⚠️ sw.js: CACHE_NAME constant not found.');
    }
}

function updatePackageJson(newVersion, dryRun) {
    const pkgPath = path.join(root, 'package.json');
    if (!fs.existsSync(pkgPath)) return;

    const pkg = readJson(pkgPath);
    const oldVersion = pkg.version;
    if (oldVersion === newVersion) {
        console.log(`ℹ️ package.json: Already at ${newVersion}`);
        return;
    }

    pkg.version = newVersion;
    writeJson(pkgPath, pkg, dryRun);
    console.log(`✅ package.json: ${oldVersion} -> ${newVersion}`);
}

function updatePackageLock(newVersion, dryRun) {
    const lockPath = path.join(root, 'package-lock.json');
    if (!fs.existsSync(lockPath)) return;

    const lock = readJson(lockPath);
    const oldVersion = lock.version;
    const rootPkg = lock.packages && lock.packages[''];
    const changed = oldVersion !== newVersion || (rootPkg && rootPkg.version !== newVersion);

    if (!changed) {
        console.log(`ℹ️ package-lock.json: Already at ${newVersion}`);
        return;
    }

    lock.version = newVersion;
    if (rootPkg) rootPkg.version = newVersion;
    writeJson(lockPath, lock, dryRun);
    console.log(`✅ package-lock.json: ${oldVersion} -> ${newVersion}`);
}

function main() {
    const { target, dryRun } = parseArgs(process.argv.slice(2));
    const newVersion = resolveNextVersion(target);
    const today = getLocalDateString();
    let hasError = false;

    if (dryRun) {
        console.log(`🔍 Dry run: previewing bump to v${newVersion} (${today})\n`);
    }

    let stats = null;
    const steps = [
        ['games.json', () => { stats = updateGamesJson(newVersion, today, dryRun); }],
        ['README.md', () => updateReadme(newVersion, stats, dryRun)],
        ['sw.js', () => updateServiceWorker(newVersion, dryRun)],
        ['package.json', () => updatePackageJson(newVersion, dryRun)],
        ['package-lock.json', () => updatePackageLock(newVersion, dryRun)]
    ];

    for (const [label, run] of steps) {
        try {
            run();
        } catch (err) {
            hasError = true;
            console.error(`❌ Error updating ${label}: ${err.message}`);
        }
    }

    if (hasError) {
        process.exit(1);
    }

    console.log(`\n${dryRun ? '📝 Dry run complete — no files written for' : '🚀 KlassKit is now'} v${newVersion}!`);
}

main();
