# 📖 Cookbook

This repository hosts my personal cookbook, a collection of my favorite recipes from various on- and offline sources.

## Features

- 🗒️ Simple, easy-to-edit markdown based recipes
- 🔍️ Search
- ⚖️ Recipe scaling
- 🌐 Importing recipes from the internet

## Adding new recipes
New recipes can be added either by running `npm run import <URL_TO_RECIPE>` when you want to import an existing recipe from the internet or `npm run new <YOUR_RECIPE_NAME>` if you want to create an empty recipe file and add it yourself.

Alternatively you can also just create ah empty markdown file in `_recipes/` and start adding recipes there.

### Setup for import

For the `import` command to work, you need an API key from [Spoonacular](https://spoonacular.com). Just sign up on their website, copy the `CLI/CREDENTIALS.example.json` file, rename it to `CLI/CREDENTIALS.json` and add your API key in there.

## Tech
This cookbook is powered by jekyll and hosted on github pages. It's originally built upon the [beautiful-jekyll](https://github.com/daattali/beautiful-jekyll) template by Dean Attali.
