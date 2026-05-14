const fs = require('fs');
const path = require('path');
const ExifReader = require('exifreader');

const fullsDir = path.join(__dirname, 'images', 'fulls');
const dataDir = path.join(__dirname, '_data');

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

async function extractExif() {
    const files = fs.readdirSync(fullsDir).filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg'));
    const photos = [];

    for (const file of files) {
        const filePath = path.join(fullsDir, file);
        try {
            const tags = await ExifReader.load(filePath);
            
            let date = tags['DateTimeOriginal'] ? tags['DateTimeOriginal'].description : null;
            if (date && date.includes(':')) {
                // EXIF date is "YYYY:MM:DD HH:MM:SS", we should parse it for sorting
                // Let's keep the raw for now or format it
                const parts = date.split(' ');
                if (parts.length > 1) {
                    date = parts[0].replace(/:/g, '-') + 'T' + parts[1] + 'Z';
                }
            }

            const getDesc = (tag) => tags[tag] ? tags[tag].description : '';
            
            photos.push({
                filename: file,
                category: "All", // default category
                date: date || new Date(fs.statSync(filePath).mtime).toISOString(),
                exif: {
                    iso: getDesc('ISOSpeedRatings') || getDesc('ISO'),
                    model: getDesc('Model'),
                    shutter_speed: getDesc('ExposureTime') ? getDesc('ExposureTime') + 's' : '',
                    aperture: getDesc('FNumber') ? 'f/' + getDesc('FNumber') : ''
                }
            });
        } catch (err) {
            console.error(`Error reading EXIF from ${file}:`, err.message);
            photos.push({
                filename: file,
                category: "All",
                date: new Date(fs.statSync(filePath).mtime).toISOString(),
                exif: {}
            });
        }
    }

    // Sort by date descending (recent first)
    photos.sort((a, b) => new Date(b.date) - new Date(a.date));

    fs.writeFileSync(path.join(dataDir, 'photos.json'), JSON.stringify(photos, null, 2));
    console.log(`Generated _data/photos.json with ${photos.length} photos.`);
}

extractExif();
