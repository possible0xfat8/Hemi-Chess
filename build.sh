#!/bin/bash
# Workaround for npm optional dependencies bug
# Install with npm install instead of npm ci
npm install && bun run build
