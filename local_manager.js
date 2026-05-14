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

// Ensure directories and data file exist
if (!fs.existsSync(fullsDir)) fs.mkdirSync(fullsDir, { recursive: true });
if (!fs.existsSync(thumbsDir)) fs.mkdirSync(thumbsDir, { recursive: true });
if (!fs.existsSync(dataFile)) fs.writeFileSync(dataFile, '[]');

app.use('/source', express.static(sourceDir));

// Find all files recursively
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

app.get('/', (req, res) => {
    const allFiles = getAllFiles(sourceDir);
    const existingPhotos = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    const existingFilenames = new Set(existingPhotos.map(p => p.filename));
    
    // Find first file not in existing
    let nextFile = null;
    let remaining = 0;
    for (const file of allFiles) {
        if (!existingFilenames.has(path.basename(file))) {
            if (!nextFile) nextFile = file;
            remaining++;
        }
    }

    if (!nextFile) {
        return res.send(`<h2>All caught up! No new photos found.</h2>`);
    }

    // Serve the UI
    const relativeUrl = encodeURI('/source/' + path.relative(sourceDir, nextFile).replace(/\\/g, '/'));
    
    res.send(`
        <html>
        <head>
            <style>
                body { font-family: sans-serif; text-align: center; background: #222; color: #fff; }
                img { max-height: 70vh; max-width: 90vw; object-fit: contain; margin: 20px 0; }
                .controls { margin-top: 20px; }
                button { font-size: 18px; padding: 10px 20px; margin: 5px; cursor: pointer; }
                .keep { background: #4CAF50; color: white; border: none; }
                .skip { background: #f44336; color: white; border: none; }
                select, input { font-size: 18px; padding: 10px; }
            </style>
        </head>
        <body>
            <h3>Pending photos: ${remaining}</h3>
            <img src="${relativeUrl}" />
            <div class="controls">
                <form method="POST" action="/process">
                    <input type="hidden" name="filepath" value="${nextFile}" />
                    <input type="text" name="category" placeholder="Category (e.g. nature, bnw, people)" required />
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
        // Just add an entry with skipped flag so it doesn't show again
        existingPhotos.push({ filename, skipped: true });
        fs.writeFileSync(dataFile, JSON.stringify(existingPhotos, null, 2));
        return res.redirect('/');
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
                if (parts.length > 1) {
                    date = parts[0].replace(/:/g, '-') + 'T' + parts[1] + 'Z';
                }
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
            return res.send(`Error processing ${filename}: ${err.message} <br><a href="/">Back</a>`);
        }
        return res.redirect('/');
    }
});

app.listen(3000, () => console.log('GUI Tool running at http://localhost:3000'));
