const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const sourceDir = 'd:\\photography\\gudClickz_sorted';
const fullsDir = path.join(__dirname, 'images', 'fulls');
const thumbsDir = path.join(__dirname, 'images', 'thumbs');

// Ensure output directories exist
if (!fs.existsSync(fullsDir)) {
    fs.mkdirSync(fullsDir, { recursive: true });
}
if (!fs.existsSync(thumbsDir)) {
    fs.mkdirSync(thumbsDir, { recursive: true });
}

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
console.log(`Found ${files.length} DSLR images. Starting resize process...`);

async function processImages() {
    let count = 0;
    for (const file of files) {
        const filename = path.basename(file);
        const fullPath = path.join(fullsDir, filename);
        const thumbPath = path.join(thumbsDir, filename);

        try {
            // Resize for fulls (1024px wide)
            await sharp(file)
                .resize(1024, null, { withoutEnlargement: true })
                .jpeg({ quality: 80 })
                .toFile(fullPath);

            // Resize for thumbs (512px wide)
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
    console.log(`Finished processing all ${files.length} images.`);
}

processImages();
