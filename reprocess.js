const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const ExifReader = require('exifreader');

const sourceDir = 'd:\\photography\\gudClickz_sorted';
const fullsDir = path.join(__dirname, 'images', 'fulls');
const thumbsDir = path.join(__dirname, 'images', 'thumbs');
const dataDir = path.join(__dirname, '_data');
const dataFile = path.join(dataDir, 'photos.json');

// Clear existing
if (fs.existsSync(fullsDir)) {
    fs.readdirSync(fullsDir).forEach(f => fs.unlinkSync(path.join(fullsDir, f)));
} else {
    fs.mkdirSync(fullsDir, { recursive: true });
}
if (fs.existsSync(thumbsDir)) {
    fs.readdirSync(thumbsDir).forEach(f => fs.unlinkSync(path.join(thumbsDir, f)));
} else {
    fs.mkdirSync(thumbsDir, { recursive: true });
}
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function findDslrFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            findDslrFiles(filePath, fileList);
        } else {
            const name = file.toLowerCase();
            if ((name.startsWith('dsc') || name.startsWith('_dsc')) && (name.endsWith('.jpg') || name.endsWith('.jpeg'))) {
                fileList.push(filePath);
            }
        }
    }
    return fileList;
}

const files = findDslrFiles(sourceDir);
console.log(`Found ${files.length} DSLR images. Starting reprocess...`);

async function processImages() {
    let count = 0;
    const photos = [];

    for (const file of files) {
        const filename = path.basename(file);
        const fullPath = path.join(fullsDir, filename);
        const thumbPath = path.join(thumbsDir, filename);

        try {
            // Read EXIF BEFORE resize
            const tags = await ExifReader.load(file);
            let date = tags['DateTimeOriginal'] ? tags['DateTimeOriginal'].description : null;
            if (date && date.includes(':')) {
                const parts = date.split(' ');
                if (parts.length > 1) {
                    date = parts[0].replace(/:/g, '-') + 'T' + parts[1] + 'Z';
                }
            }

            const getDesc = (tag) => tags[tag] ? tags[tag].description : '';
            
            photos.push({
                filename,
                category: "All", // default
                date: date || new Date(fs.statSync(file).mtime).toISOString(),
                exif: {
                    iso: getDesc('ISOSpeedRatings') || getDesc('ISO'),
                    model: getDesc('Model'),
                    shutter_speed: getDesc('ExposureTime') ? getDesc('ExposureTime') + 's' : '',
                    aperture: getDesc('FNumber') ? 'f/' + getDesc('FNumber') : ''
                }
            });

            // Resize
            await sharp(file)
                .resize(1024, null, { withoutEnlargement: true })
                .jpeg({ quality: 80 })
                .toFile(fullPath);

            await sharp(file)
                .resize(512, null, { withoutEnlargement: true })
                .jpeg({ quality: 70 })
                .toFile(thumbPath);
            
            count++;
            if (count % 10 === 0) {
                console.log(`Processed ${count}/${files.length} images...`);
            }
        } catch (err) {
            console.error(`Error processing ${file}: ${err.message}`);
        }
    }

    photos.sort((a, b) => new Date(b.date) - new Date(a.date));
    fs.writeFileSync(dataFile, JSON.stringify(photos, null, 2));

    console.log(`Finished processing all ${files.length} images.`);
}

processImages();
