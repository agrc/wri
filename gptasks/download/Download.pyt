import arcpy
import main


class Toolbox:
    def __init__(self):
        self.label = "wridownload"
        self.alias = "wridownload"

        # List of tool classes associated with this toolbox
        self.tools = [Tool]


class Tool:
    def __init__(self):
        self.label = "Download"
        self.description = "Download WRI Data"
        self.canRunInBackground = True

    def getParameterInfo(self):
        """Returns the parameters required for this tool"""

        p0 = arcpy.Parameter(
            displayName="project id strings",
            name="project_ids",
            datatype="String",
            parameterType="Required",
            direction="Input",
        )

        p1 = arcpy.Parameter(
            displayName="Output zip file",
            name="output",
            datatype="File",
            parameterType="Derived",
            direction="Output",
        )

        return [p0, p1]

    def execute(self, parameters, messages):
        """Returns the location on the server of a zip file
        :param parameters: the parameters sent to the gp service
        :param message:
        """
        project_ids = [pid.strip() for pid in parameters[0].valueAsText.split(",") if pid.strip()]
        for pid in project_ids:
            if not pid.isdigit():
                raise ValueError(f"Invalid project ID '{pid}'. Project IDs must be numeric.")

        zip_location = main.execute(project_ids)

        arcpy.SetParameterAsText(1, zip_location)

    def isLicensed(self):
        """Determines if the tool is licensed to run"""
        return True
