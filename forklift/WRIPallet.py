#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
WRIPallet.py
A module that defines a forklift pallet for the WRI project.
"""

from pathlib import Path

from forklift.models import Pallet


class WRIPallet(Pallet):
    def build(self):
        udwr = str(Path(self.staging_rack) / "UDWRRT2.gdb")

        self.copy_data = [udwr]

        self.add_crates(
            [
                "NRCS_precip1981_2010_a_ut",
            ],
            {
                "source_workspace": str(Path(self.garage) / "UDWRRT2.sde"),
                "destination_workspace": udwr,
            },
        )
