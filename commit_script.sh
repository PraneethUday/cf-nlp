#!/bin/zsh

# This script adds and commits each file individually with a specific message.

# Root directory files
git add .gitignore
git commit -m "chore: Add gitignore file"

git add analyze_webpage.py
git commit -m "feat: Add script for analyzing webpages"

git add cf-api.txt
git commit -m "docs: Add codeforces API information"

git add methords.txt
git commit -m "docs: Add methods documentation"

git add next-env.d.ts
git commit -m "build: Add Next.js environment type definitions"

git add next.config.js
git commit -m "feat: Configure Next.js application"

git add package.json
git commit -m "feat: Initialize project and add dependencies"

git add prompt.txt
git commit -m "feat: Add prompt for NLP model"

git add README.md
git commit -m "docs: Add initial project README"

git add return-objects.txt
git commit -m "docs: Document return objects"

git add tsconfig.json
git commit -m "build: Add TypeScript configuration"

# App directory
git add app/globals.css
git commit -m "style: Add global styles for the application"

git add app/layout.tsx
git commit -m "feat: Add root layout for the Next.js application"

git add app/page.tsx
git commit -m "feat: Add main page for the application"

git add app/analytics/analytics.css
git commit -m "style: Add styles for the analytics page"

git add app/analytics/page.tsx
git commit -m "feat: Add analytics page component"

git add app/api/cf/route.ts
git commit -m "feat: Add API route for codeforces services"

git add app/api/insights/route.ts
git commit -m "feat: Add API route for providing insights"

git add app/components/Welcome.css
git commit -m "style: Add styles for the Welcome component"

git add app/components/Welcome.tsx
git commit -m "feat: Add Welcome component"

# client-development directory
git add client-development/0.pack.gz
git commit -m "chore: Add client development pack file"

git add client-development/index.pack.gz
git commit -m "chore: Add client development index pack file"

# lib directory
git add lib/analytics/aggregate.ts
git commit -m "feat: Add analytics data aggregation logic"

git add lib/cf/client.ts
git commit -m "feat: Add codeforces client implementation"

git add lib/cf/sign.ts
git commit -m "feat: Add request signing logic for codeforces API"

