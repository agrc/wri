#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
configs.py
----------------------------------

the configs for this tool
"""

from pathlib import Path

data_directory = Path(__file__).resolve().parent / "data"

# (connection_path, prefix)
# some of these may need to be commented out when publishing to prevent analyzing errors
local = (str(data_directory / "dev.gpkg"), "main.")
dev = (str(data_directory / "WRI_DEV as WRI_READ.sde"), "WRI.dbo.")
at = (str(data_directory / "WRI_AT as WRI_USER.sde"), "WRI_AT.dbo.")
prod = (str(data_directory / "WRI_PROD as WRI_READ.sde"), "WRI.dbo.")
