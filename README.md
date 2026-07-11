# Mohammad Ammar - Professional Portfolio Website

A highly aesthetic, premium, and responsive personal portfolio website built using **Jekyll** and custom modern **CSS**.

## 🚀 Quick Start (Local Testing)

This project has been set up with local Bundler binstubs. You can test and serve the site locally by running:

```bash
./bin/jekyll serve
```

Then open your browser and navigate to `http://localhost:4000`.

## 📁 Directory Structure

```text
├── .github/workflows/
│   └── jekyll.yml       # GitHub Actions deploy configuration
├── _includes/
│   ├── header.html      # Glassmorphism header and navigation
│   └── footer.html      # Footer with social links
├── _layouts/
│   ├── default.html     # Base html wrapper with styling
│   ├── page.html        # Simple page wrapper
│   └── post.html        # Highly readable blog article wrapper
├── _posts/
│   └── 2026-07-10-power-of-integrated-digital-marketing.md  # Blog post
├── assets/
│   ├── css/
│   │   └── style.css    # Premium style system (gradients, blobs)
│   └── js/
│       └── main.js      # Nav logic and scroll interactions
├── _config.yml          # Jekyll configuration
├── blog.html            # Blog archive list page
├── Gemfile              # Local dependency definitions
└── index.html           # Main portfolio homepage
```

## 🛠️ GitHub Pages Deployment

To put this site live on GitHub:
1. Initialize Git in the `Portfolio/` directory:
   ```bash
   git init -b main
   git add .
   git commit -m "Initial portfolio commit"
   ```
2. Create a repository on GitHub (e.g., `portfolio`).
3. Connect your local repository to GitHub and push:
   ```bash
   git remote add origin https://github.com/yourusername/portfolio.git
   git push -u origin main
   ```
4. On GitHub, go to your repository **Settings > Pages**.
5. Under **Build and deployment**, select **GitHub Actions** as the source.
6. The included workflow `.github/workflows/jekyll.yml` will trigger, build your site, and deploy it to `https://yourusername.github.io/portfolio` in 10-30 seconds.
