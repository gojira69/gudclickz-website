# Sriharsha's Photography Portfolio

Welcome to my photography portfolio website! This site showcases my photography work.

## How to add new images

1. **Upload your pictures:** Add your images to the `images/fulls` directory for the full-resolution versions, and `images/thumbs` for the thumbnail versions. 
   - *Note:* Make sure the names of the thumbnails match the names of the full images exactly.
2. **Push your changes:** Once you've added your images, commit and push the changes to your GitHub repository. The website will automatically update with the new images.

## Publishing to GitHub Pages

1. Go to your repository settings on GitHub.
2. Navigate to the **Pages** section on the left sidebar.
3. Under **Source**, select the branch you want to deploy from (usually `master` or `main`) and the `/ (root)` folder.
4. Click **Save**. GitHub will automatically build and publish your site at `https://[yourusername].github.io/[repository-name]`.
5. You can configure a custom domain in the Pages settings if you own one.

## Running locally

If you have Ruby and Jekyll installed, you can run the website locally:

```bash
bundle install
bundle exec jekyll serve
```

Then visit `http://localhost:4000` in your browser.
