"""
Test the download tool on all projects in the database
"""

from pathlib import Path
from random import randint
from shutil import copy

import arcpy
import configs
import main

current_directory = Path(__file__).resolve().parent
arcpy.ImportToolbox(str(current_directory / "Download.pyt"), "wridownload")

with arcpy.da.SearchCursor(
    str(Path(configs.local[0]) / "PROJECT"), ["Project_ID"]
) as cursor:
    project_ids = [str(project_id) for (project_id,) in cursor]

max_index = len(project_ids) - 1


def multiple_projects_test():
    #: test random collections of multiple projects
    print("\n\nTESTING MULTIPLE PROJECTS")
    num_tests = 20
    test_count = 1
    while test_count <= num_tests:
        sample_number = randint(2, 15)

        sample_projects = [
            project_ids[randint(0, max_index)] for _ in range(1, sample_number)
        ]

        print(
            "\n\nTESTING PROJECT IDS ({} of {}): {}".format(
                test_count, num_tests, ", ".join(sample_projects)
            )
        )
        zip_path = main.execute(sample_projects)

        #: copy to output folder for inspection
        output_folder = current_directory / "output"
        output_folder.mkdir(exist_ok=True)
        output_path = output_folder / f"multiple_projects_test_{test_count}.zip"
        copy(zip_path, output_path)

        #: add project ids to a text file for reference
        with open(
            output_folder / f"multiple_projects_test_{test_count}_projects.txt", "w"
        ) as f:
            f.write("\n".join(sample_projects))

        test_count += 1


def individual_projects_test():
    #: test random individual projects
    num_tests = 50
    test_count = 1
    for project in [project_ids[randint(0, max_index)] for _ in range(1, num_tests)]:
        print(
            "\n\nTESTING PROJECT: {} ({} of {})".format(project, test_count, num_tests)
        )
        zip_path = main.execute([project])

        #: copy to output folder for inspection
        output_folder = current_directory / "output"
        output_folder.mkdir(exist_ok=True)
        output_path = output_folder / f"individual_project_test_{test_count}.zip"
        copy(zip_path, output_path)

        #: add project id to a text file for reference
        with open(
            output_folder / f"individual_project_test_{test_count}_project.txt", "w"
        ) as f:
            f.write(project)

        test_count += 1


multiple_projects_test()
individual_projects_test()

print("SUCCESS!!!")
