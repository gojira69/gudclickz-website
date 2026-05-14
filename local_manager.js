const express = require('express');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ExifReader = require('exifreader');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const sourceDir = 'd:\\photography\\gudClickz_sorted';
const fullsDir = path.join(__dirname, 'images', 'fulls');
const thumbsDir = path.join(__dirname, 'images', 'thumbs');
const dataFile = path.join(__dirname, '_data', 'photos.json');

if (!fs.existsSync(fullsDir)) fs.mkdirSync(fullsDir, { recursive: true });
if (!fs.existsSync(thumbsDir)) fs.mkdirSync(thumbsDir, { recursive: true });
if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, '[]');

app.use('/source', express.static(sourceDir));
app.use('/thumbs', express.static(thumbsDir));

const defaultTags = ["Portrait", "Landscape", "Nature", "Black and White", "Street", "Architecture", "Macro", "Wildlife", "Night", "Abstract"];

function getAllTags(existingPhotos) {
    const tagSet = new Set(defaultTags);
    existingPhotos.forEach(p => {
        if (p.category && p.category !== "All") {
            p.category.split(',').map(t => t.trim()).filter(Boolean).forEach(t => tagSet.add(t));
        }
    });
    return Array.from(tagSet).sort();
}

// UI helper
function getUIHeader() {
    return `
        <style>
            body { font-family: sans-serif; background: #222; color: #fff; margin: 0; padding: 20px; text-align: center; }
            a { color: #4CAF50; text-decoration: none; margin: 0 10px; }
            a:hover { text-decoration: underline; }
            .nav { margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #444; }
            .tag-pill { display: inline-block; padding: 5px 10px; margin: 5px; background: #444; border-radius: 15px; cursor: pointer; user-select: none; border: 1px solid #555; transition: 0.2s; }
            .tag-pill:hover { background: #555; }
            .tag-pill.active { background: #4CAF50; color: white; border-color: #4CAF50; }
            input[type=text] { padding: 10px; width: 400px; font-size: 16px; margin: 10px 0; background: #333; color: white; border: 1px solid #555; }
            button { font-size: 18px; padding: 10px 20px; margin: 5px; cursor: pointer; border-radius: 5px; border: none; }
            .keep { background: #4CAF50; color: white; }
            .skip { background: #f44336; color: white; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; margin-top: 20px;}
            .grid-item { background: #333; padding: 10px; border-radius: 5px; cursor: pointer; transition: 0.2s; }
            .grid-item:hover { transform: scale(1.02); background: #444; }
            .grid-item img { width: 100%; height: 150px; object-fit: cover; }
            .grid-item p { margin: 10px 0 0 0; font-size: 14px; font-weight: bold; color: #aaa; }
        </style>
        <script>
            function toggleTag(tag) {
                const input = document.getElementById('category-input');
                let tags = input.value.split(',').map(t => t.trim()).filter(Boolean);
                if (tags.includes(tag)) {
                    tags = tags.filter(t => t !== tag);
                } else {
                    tags.push(tag);
                }
                input.value = tags.join(', ');
                updatePills();
            }
            function updatePills() {
                const input = document.getElementById('category-input');
                if(!input) return;
                const tags = input.value.split(',').map(t => t.trim().toLowerCase());
                document.querySelectorAll('.tag-pill').forEach(pill => {
                    if (tags.includes(pill.innerText.trim().toLowerCase())) {
                        pill.classList.add('active');
                    } else {
                        pill.classList.remove('active');
                    }
                });
            }
            window.onload = function() {
                const input = document.getElementById('category-input');
                if(input) {
                    input.addEventListener('input', updatePills);
                    updatePills();
                }
            };
        </script>
        <div class="nav">
            <a href="/pending">Process New Photos</a>
            <a href="/existing">Manage Existing Tags</a>
        </div>
    `;
}

// Find all files
function getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            getAllFiles(filePath, fileList);
        } else {
            const ext = path.extname(file).toLowerCase();
            if (ext === '.jpg' || ext === '.jpeg') {
                fileList.push(filePath);
            }
        }
    }
    return fileList;
}

app.get('/', (req, res) => res.redirect('/pending'));

app.get('/pending', (req, res) => {
    const allFiles = getAllFiles(sourceDir);
    const existingPhotos = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    const existingFilenames = new Set(existingPhotos.map(p => p.filename));
    
    let nextFile = null;
    let remaining = 0;
    for (const file of allFiles) {
        if (!existingFilenames.has(path.basename(file))) {
            if (!nextFile) nextFile = file;
            remaining++;
        }
    }

    if (!nextFile) return res.send(getUIHeader() + `<h2>All caught up! No new photos found.</h2>`);

    const relativeUrl = encodeURI('/source/' + path.relative(sourceDir, nextFile).replace(/\\/g, '/'));
    const allTags = getAllTags(existingPhotos);
    
    res.send(`
        <html>
        <head>${getUIHeader()}</head>
        <body>
            <h3>Pending photos: ${remaining}</h3>
            <img src="${relativeUrl}" style="max-height: 50vh; max-width: 90vw; object-fit: contain; margin: 10px 0;" />
            
            <div style="max-width: 800px; margin: 0 auto;">
                <div>
                    ${allTags.map(t => `<div class="tag-pill" onclick="toggleTag('${t}')">${t}</div>`).join('')}
                </div>
                <form method="POST" action="/process">
                    <input type="hidden" name="filepath" value="${nextFile}" />
                    <input type="text" id="category-input" name="category" placeholder="Tags (e.g. Nature, Portrait)" value="" required />
                    <br>
                    <button type="submit" name="action" value="keep" class="keep">Keep & Add</button>
                    <button type="submit" name="action" value="skip" class="skip" formnovalidate>Skip (Ignore)</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

app.post('/process', async (req, res) => {
    const { filepath, category, action } = req.body;
    const filename = path.basename(filepath);
    const existingPhotos = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

    if (action === 'skip') {
        existingPhotos.push({ filename, skipped: true });
        fs.writeFileSync(dataFile, JSON.stringify(existingPhotos, null, 2));
        return res.redirect('/pending');
    }

    if (action === 'keep') {
        const fullPath = path.join(fullsDir, filename);
        const thumbPath = path.join(thumbsDir, filename);
        try {
            await sharp(filepath).resize(1024, null, { withoutEnlargement: true }).jpeg({ quality: 80 }).toFile(fullPath);
            await sharp(filepath).resize(512, null, { withoutEnlargement: true }).jpeg({ quality: 70 }).toFile(thumbPath);
            
            const tags = await ExifReader.load(filepath);
            let date = tags['DateTimeOriginal'] ? tags['DateTimeOriginal'].description : null;
            if (date && date.includes(':')) {
                const parts = date.split(' ');
                if (parts.length > 1) date = parts[0].replace(/:/g, '-') + 'T' + parts[1] + 'Z';
            }

            const getDesc = (tag) => tags[tag] ? tags[tag].description : '';
            existingPhotos.push({
                filename,
                category,
                date: date || new Date(fs.statSync(filepath).mtime).toISOString(),
                exif: {
                    iso: getDesc('ISOSpeedRatings') || getDesc('ISO'),
                    model: getDesc('Model'),
                    shutter_speed: getDesc('ExposureTime') ? getDesc('ExposureTime') + 's' : '',
                    aperture: getDesc('FNumber') ? (getDesc('FNumber').startsWith('f/') ? getDesc('FNumber') : 'f/' + getDesc('FNumber')) : ''
                }
            });
            existingPhotos.sort((a, b) => new Date(b.date) - new Date(a.date));
            fs.writeFileSync(dataFile, JSON.stringify(existingPhotos, null, 2));
        } catch (err) {
            console.error(err);
            return res.send(`Error processing ${filename}: ${err.message} <br><a href="/pending">Back</a>`);
        }
        return res.redirect('/pending');
    }
});

app.get('/existing', (req, res) => {
    const existingPhotos = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    const photos = existingPhotos.filter(p => !p.skipped);

    res.send(`
        <html>
        <head>${getUIHeader()}</head>
        <body>
            <h2>Manage Existing Photos</h2>
            <div class="grid">
                ${photos.map(p => `
                    <div class="grid-item" onclick="window.location.href='/edit/${p.filename}'">
                        <img src="/thumbs/${p.filename}" />
                        <p>${p.category || 'No tags'}</p>
                    </div>
                `).join('')}
            </div>
        </body>
        </html>
    `);
});

app.get('/edit/:filename', (req, res) => {
    const filename = req.params.filename;
    const existingPhotos = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    const photo = existingPhotos.find(p => p.filename === filename);
    
    if (!photo) return res.status(404).send('Photo not found');

    const allTags = getAllTags(existingPhotos);

    res.send(`
        <html>
        <head>${getUIHeader()}</head>
        <body>
            <h2>Edit Tags</h2>
            <img src="/thumbs/${photo.filename}" style="max-height: 40vh; object-fit: contain; margin: 10px 0;" />
            <div style="max-width: 800px; margin: 0 auto;">
                <div>
                    ${allTags.map(t => `<div class="tag-pill" onclick="toggleTag('${t}')">${t}</div>`).join('')}
                </div>
                <form method="POST" action="/update">
                    <input type="hidden" name="filename" value="${photo.filename}" />
                    <input type="text" id="category-input" name="category" placeholder="Tags (comma separated)" value="${photo.category || ''}" required />
                    <br>
                    <button type="submit" class="keep">Save Tags</button>
                    <button type="button" class="skip" onclick="window.location.href='/existing'">Cancel</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

app.post('/update', (req, res) => {
    const { filename, category } = req.body;
    const existingPhotos = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    const photo = existingPhotos.find(p => p.filename === filename);
    if (photo) {
        photo.category = category;
        fs.writeFileSync(dataFile, JSON.stringify(existingPhotos, null, 2));
    }
    res.redirect('/existing');
});

app.listen(3000, () => console.log('GUI Tool running at http://localhost:3000'));
