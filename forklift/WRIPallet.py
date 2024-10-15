#!/usr/bin/env python
# -*- coding: utf-8 -*-
'''
WRIPallet.py
A module that defines a forklift pallet for the WRI project.
'''

from pathlib import Path

import arcpy

from forklift.models import Pallet


class WRIPallet(Pallet):
    def build(self, configuration):
        sgid = str(Path(self.staging_rack) / 'SGID10.gdb')
        udnr = str(Path(self.staging_rack) / 'UDNR.gdb')
        udwr = str(Path(self.staging_rack) / 'UDWRRT2.gdb')

        self.copy_data = [sgid, udnr, udwr]

        self.add_crates([
            'BLMDistricts',
            'LandOwnership',
            'ZoomLocations',
            'Counties',
            'StreamsNHDHighRes',
            'Watersheds_Area'
        ], {'source_workspace': str(Path(self.garage) / 'SGID.sde'), 'destination_workspace': sgid})

        self.add_crates([
            'SageGrouse_SGMA_outlines',
            'Regions'
        ], {'source_workspace': str(Path(self.garage) / 'UDNR.sde'), 'destination_workspace': udnr})

        self.add_crates([
            'NRCS_precip1981_2010_a_ut',
            'SiteInfo'
        ], {'source_workspace': str(Path(self.garage) / 'UDWRRT2.sde'), 'destination_workspace': udwr})

    def process(self):
        for crate in [crate for crate in self.get_crates() if crate.was_updated()]:
            self.log.debug('crate %s was updated', crate.source_name.lower())

            if crate.source_name.lower() != 'sgid.water.watersheds_area':
                continue

            self.log.debug('watersheds area updated, rebuilding')
            dissolve_location = str(Path(crate.destination_workspace) / "Watershed_Areas_Dissolved")

            self.log.debug('dissolve layer location %s', dissolve_location)

            if arcpy.Exists(dissolve_location):
                self.log.debug('table exists, deleting')

                arcpy.management.Delete(dissolve_location)

            arcpy.management.Dissolve(in_features=crate.destination, out_feature_class=dissolve_location, dissolve_field=["HUC_10"], statistics_fields="HU_10_NAME FIRST")
