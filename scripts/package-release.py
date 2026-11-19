#!/usr/bin/env python3
"""Convenience wrapper around scripts/package-release.js."""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.exit(subprocess.call(["node", os.path.join(ROOT, "scripts", "package-release.js"), *sys.argv[1:]]))
