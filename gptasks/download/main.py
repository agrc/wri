"""
The main logic for the download tool. Extracted to a separate file to make debugging and testing easier.
Naming this download.py caused issues when publishing to arcgis server.
"""

from glob import glob
from os import makedirs, remove, sep, walk
from os.path import exists, isdir, join, splitext
from pathlib import Path
from shutil import rmtree
from zipfile import ZIP_DEFLATED, ZipFile

import arcpy
import configs

current_directory = Path(__file__).resolve().parent

version = "1.0.3"
fgdb = "WriSpatial.gdb"
configuration = "at"


class Table:
    geometry_type = None

    def __init__(self, table_name, fields):
        self.table_name = table_name
        self._fields = fields

    @property
    def fields(self):
        return [field_name[0] for field_name in self._fields]

    def create_table(self, location, table):
        arcpy.AddMessage("-- create table " + table.table_name)
        arcpy.management.CreateTable(location, table.table_name)

    def create_schema(self):
        for field in self._fields:
            self._add_field(self.table_name, field)

    def get_sql(self, project_ids):
        with open(
            join(current_directory, "sql", "{}.sql".format(self.table_name))
        ) as sql_file:
            return sql_file.read().format(",".join([str(id) for id in project_ids]))

    def _add_field(self, table, field):
        if len(field) == 1:
            return

        arcpy.AddMessage("-- adding field " + field[0])

        if len(field) == 4:
            arcpy.management.AddField(
                in_table=table,
                field_name=field[0],
                field_type=field[1],
                field_is_nullable=field[2],
                field_length=field[3],
            )

            return

        arcpy.management.AddField(
            in_table=table,
            field_name=field[0],
            field_type=field[1],
            field_is_nullable=field[2],
        )


class SpatialTable(Table):
    _table_name_to_geometry_type = {
        "POINT": "MULTIPOINT",
        "LINE": "POLYLINE",
        "POLY": "POLYGON",
    }

    @property
    def geometry_type(self):
        return self._table_name_to_geometry_type[self.table_name]

    def create_table(self, location, table):
        arcpy.AddMessage("-- create table " + table.table_name)
        arcpy.management.CreateFeatureclass(
            location,
            table.table_name,
            geometry_type=table.geometry_type,
            spatial_reference=arcpy.SpatialReference(3857),
        )

    def get_sql(self, project_ids):
        return "SELECT *, CONCAT('{0}:', FeatureID) as Composite_Key FROM {0} WHERE Project_ID in ({1})".format(
            self.table_name, ",".join([str(id) for id in project_ids])
        )


tables = [
    SpatialTable(
        "POINT",
        [
            ("TypeDescription", "TEXT", "NULLABLE", 255),
            ("FeatureID", "LONG", "NON_NULLABLE"),
            ("FeatureSubTypeDescription", "TEXT", "NULLABLE", 255),
            ("ActionDescription", "TEXT", "NULLABLE", 255),
            ("Description", "TEXT", "NULLABLE", 255),
            ("Project_ID", "LONG", "NON_NULLABLE"),
            ("StatusDescription", "TEXT", "NULLABLE", 50),
            ("Composite_Key", "TEXT", "NON_NULLABLE", 255),
            ("Shape@",),
        ],
    ),
    SpatialTable(
        "LINE",
        [
            ("TypeDescription", "TEXT", "NULLABLE", 255),
            ("FeatureID", "LONG", "NON_NULLABLE"),
            ("FeatureSubTypeDescription", "TEXT", "NULLABLE", 255),
            ("ActionDescription", "TEXT", "NULLABLE", 255),
            ("Description", "TEXT", "NULLABLE", 255),
            ("Project_ID", "LONG", "NON_NULLABLE"),
            ("StatusDescription", "TEXT", "NULLABLE", 50),
            ("Composite_Key", "TEXT", "NON_NULLABLE", 255),
            ("Shape@",),
        ],
    ),
    SpatialTable(
        "POLY",
        [
            ("TypeDescription", "TEXT", "NULLABLE", 255),
            ("FeatureID", "LONG", "NON_NULLABLE"),
            ("Project_ID", "LONG", "NON_NULLABLE"),
            ("StatusDescription", "TEXT", "NULLABLE", 50),
            ("Retreatment", "TEXT", "NULLABLE", 1),
            ("Composite_Key", "TEXT", "NON_NULLABLE", 255),
            ("Shape@",),
        ],
    ),
    Table(
        "COUNTY",
        [
            ("County", "TEXT", "NULLABLE", 255),
            ("CountyInfoID", "LONG", "NON_NULLABLE"),
            ("FeatureID", "LONG", "NON_NULLABLE"),
            ("County_ID", "LONG", "NON_NULLABLE"),
            ("Intersection", "FLOAT", "NULLABLE"),
            ("Composite_Key", "TEXT", "NON_NULLABLE", 255),
        ],
    ),
    Table(
        "AREAACTION",
        [
            ("ActionDescription", "TEXT", "NULLABLE", 255),
            ("AreaActionID", "LONG", "NON_NULLABLE"),
            ("FeatureID", "LONG", "NON_NULLABLE"),
        ],
    ),
    Table(
        "AREATREATMENT",
        [
            ("TreatmentTypeDescription", "TEXT", "NULLABLE", 255),
            ("AreaTreatmentID", "LONG", "NON_NULLABLE"),
            ("AreaActionID", "LONG", "NON_NULLABLE"),
        ],
    ),
    Table(
        "AREAHERBICIDE",
        [
            ("HerbicideDescription", "TEXT", "NULLABLE", 255),
            ("AreaHerbicideID", "LONG", "NON_NULLABLE"),
            ("AreaTreatmentID", "LONG", "NON_NULLABLE"),
            ("HerbicideID", "LONG", "NULLABLE"),
        ],
    ),
]


def _get_db(who):
    if who == "dev":
        return configs.dev
    if who == "at":
        return configs.at
    if who == "prod":
        return configs.prod

    return configs.local


workspace, prefix = _get_db(configuration)


#: the code below used to be in a class
#: converting to functions may have helped with publishing to arcgis server issues
def execute(project_ids: list[str]) -> str:
    arcpy.AddMessage(
        "executing version {} with {} configuration".format(version, configuration)
    )

    output_location = arcpy.env.scratchFolder
    folder_to_zip = output_location

    # not needed when running on server
    _delete_scratch_data(output_location)
    _create_scratch_folder(output_location)

    gdb = _create_fgdb(output_location)
    _copy_project_centroids(gdb, project_ids)
    records = _get_rows_for_tables(project_ids)
    _export_to_fgdb(gdb, records)
    _create_relationship_classes(gdb)

    zip_location = join(folder_to_zip, "SpatialData" + ".zip")
    arcpy.AddMessage("-Zipping the result in " + folder_to_zip)
    arcpy.AddMessage("-Zipping the result to " + zip_location)

    _zip_output_directory(folder_to_zip, zip_location)

    return zip_location


def _copy_project_centroids(gdb, project_ids):
    arcpy.AddMessage("--_copy_project_centroids::")
    where = "Project_ID in ({})".format(",".join([str(id) for id in project_ids]))
    sql = f"Select * from PROJECT WHERE {where}"
    layer = "PROJECT_layer"
    if workspace.endswith(".gpkg"):
        arcpy.management.CreateDatabaseView(workspace, layer, sql)
    else:
        arcpy.management.MakeQueryLayer(workspace, layer, sql, shape_type="POINT")

    #: this has to be done in a specific way or else Pro analyze throws broken data source errors while publishing
    gdb_path = Path(gdb)
    project = str(gdb_path / "PROJECT")
    arcpy.management.CopyFeatures(layer, project)
    arcpy.management.Delete(layer)


def _get_rows_for_tables(project_ids):
    results = {}
    arcpy.env.workspace = workspace

    for table in tables:
        if table.table_name == "POINT":
            where = "Project_ID in ({})".format(
                ",".join([str(id) for id in project_ids])
            )

            field_names = table.fields
            field_names.remove("Composite_Key")

            with arcpy.da.SearchCursor(
                f"{prefix}{table.table_name}",
                field_names=field_names,
                where_clause=where,
            ) as cursor:
                id_x = cursor.fields.index("FeatureID")

                for row in cursor:
                    new_row = list(row)
                    new_row.insert(len(row) - 1, "POINT:{}".format(row[id_x]))

                    results.setdefault(table.table_name, []).append(new_row)
        else:
            arcpy.AddMessage(
                "-creating feature layer {}_layer".format(table.table_name)
            )
            arcpy.AddMessage("--sql {}".format(table.get_sql(project_ids)))

            if workspace.endswith(".gpkg"):
                query_layer = arcpy.management.CreateDatabaseView(
                    workspace,
                    "{}_layer".format(table.table_name),
                    table.get_sql(project_ids),
                )
            else:
                query_layer = arcpy.management.MakeQueryLayer(
                    workspace,
                    "{}_layer".format(table.table_name),
                    table.get_sql(project_ids),
                    shape_type=table.geometry_type,
                )

            with arcpy.da.SearchCursor(query_layer, field_names=table.fields) as cursor:
                for row in cursor:
                    results.setdefault(table.table_name, []).append(row)

            #: not needed when run as gptask on server
            arcpy.management.Delete(query_layer)

    return results


def _export_to_fgdb(gdb_path, records):
    arcpy.env.workspace = gdb_path
    for feature_class_name in records.keys():
        table = _get_table_from_name(feature_class_name)
        table.create_table(gdb_path, table)
        table.create_schema()

        with arcpy.da.InsertCursor(
            in_table=feature_class_name, field_names=table.fields
        ) as cursor:
            for row in records[feature_class_name]:
                cursor.insertRow(row)


def _get_table_from_name(name):
    return [table for table in tables if table.table_name == name][0]


def _create_scratch_folder(directory):
    arcpy.AddMessage("--_create_scratch_folder::{}".format(directory))

    if not exists(directory):
        makedirs(directory)


def _delete_scratch_data(directory):
    arcpy.AddMessage("--_delete_scratch_data::{}".format(directory))

    if not exists(directory):
        return
    for item in glob(join(directory, "*")):
        if item.endswith(".gdb"):
            #: clear any lock files
            arcpy.management.ClearWorkspaceCache(item)
        if isdir(item):
            rmtree(item)
        else:
            remove(item)

    return True


def _create_fgdb(output_location):
    """Creates and writes values to a file geodatabase
    :param output_location: the parent folder to the *.gdb
    """
    arcpy.AddMessage("--create_fgdb::{}".format(output_location))

    arcpy.management.CreateFileGDB(output_location, fgdb)
    output_location = join(output_location, fgdb)

    return output_location


def _zip_output_directory(source_location, destination_location):
    """creates a zip folder based on the `source_location` and `destination_location` parameters.
    :param source_location: the location of the folder to compress
    :param destination_location: the location and name to save the zip file
    """
    arcpy.AddMessage("--_zip_output_directory::{}".format(destination_location))

    with ZipFile(destination_location, "w", ZIP_DEFLATED) as zip_writer:
        for root, _, files in walk(source_location):
            if "scratch.gdb" in root:
                continue
            for file_name in files:
                extension = _get_extension(file_name)
                if extension in [".zip", ".lock"]:
                    continue

                full_name = join(root, file_name)
                name = full_name[len(source_location) + len(sep) :]
                zip_writer.write(full_name, name)


def _get_extension(f):
    """Returns the file type extension
    :param f: the file to get the extension of
    """
    _, file_extension = splitext(f)

    return file_extension.lower()


def _create_relationship_classes(gdb):
    """Creates all of the relationship classes in the gdb
    :param gdb: the path to the gdb
    """
    #: this has to be done in a specific way or else Pro analyze throws broken data source errors while publishing
    gdb_path = Path(gdb)
    treatment = str(gdb_path / "AREATREATMENT")
    action = str(gdb_path / "AREAACTION")
    herbicide = str(gdb_path / "AREAHERBICIDE")
    project = str(gdb_path / "PROJECT")

    #: create action -> treatment relationship
    treatment_exists = arcpy.Exists(treatment)
    if treatment_exists and arcpy.Exists(action):
        arcpy.management.CreateRelationshipClass(
            action,
            treatment,
            "AREAACTION__HAS__AREATREATMENT",
            "SIMPLE",
            "Treatments",
            "Action",
            "BOTH",
            "ONE_TO_MANY",
            "NONE",
            "AreaActionID",
            "AreaActionID",
        )

    #: create treatment -> herbicide relationship
    if treatment_exists and arcpy.Exists(herbicide):
        arcpy.management.CreateRelationshipClass(
            treatment,
            herbicide,
            "AREATREATMENT__HAS__AREAHERBICIDE",
            "SIMPLE",
            "Herbicides",
            "Treatment",
            "BOTH",
            "ONE_TO_MANY",
            "NONE",
            "AreaTreatmentID",
            "AreaTreatmentID",
        )

    for destination in ["AREAACTION"]:
        for origin in ["POINT", "LINE", "POLY"]:
            if arcpy.Exists(origin) and arcpy.Exists(destination):
                arcpy.management.CreateRelationshipClass(
                    origin,
                    destination,
                    "{}__HAS__{}".format(origin, destination),
                    "SIMPLE",
                    destination,
                    origin,
                    "BOTH",
                    "ONE_TO_MANY",
                    "NONE",
                    "FeatureID",
                    "FeatureID",
                )

    for destination in ["COUNTY"]:
        for origin in ["POINT", "LINE", "POLY"]:
            if arcpy.Exists(origin) and arcpy.Exists(destination):
                arcpy.management.CreateRelationshipClass(
                    origin,
                    destination,
                    "{}__HAS__{}".format(origin, destination),
                    "SIMPLE",
                    destination,
                    origin,
                    "BOTH",
                    "ONE_TO_MANY",
                    "NONE",
                    "Composite_Key",
                    "Composite_Key",
                )

    # Create relationship classes for project centroids
    if arcpy.Exists(project):
        for destination in ["POINT", "LINE", "POLY"]:
            if arcpy.Exists(destination):
                arcpy.management.CreateRelationshipClass(
                    project,
                    destination,
                    "PROJECT__HAS__{}".format(destination),
                    "SIMPLE",
                    destination,
                    "PROJECT",
                    "BOTH",
                    "ONE_TO_MANY",
                    "NONE",
                    "Project_ID",
                    "Project_ID",
                )


if __name__ == "__main__":
    import sys

    execute(sys.argv[1].split(","))
