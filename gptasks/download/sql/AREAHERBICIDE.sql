SELECT
  AreaHerbicideID,
  h.AreaTreatmentID,
  HerbicideID,
  HerbicideDescription
FROM AREAHERBICIDE h

LEFT JOIN AREATREATMENT t
on h.AreaTreatmentID = t.AreaTreatmentID

LEFT JOIN AREAACTION a
ON a.AreaActionID = t.AreaActionID

LEFT JOIN POLY p
ON a.FeatureID = p.FeatureID
LEFT JOIN LINE l
ON a.FeatureID = l.FeatureID
LEFT JOIN POINT pt
ON a.FeatureID = pt.FeatureID

WHERE p.Project_ID IN ({0}) OR l.Project_ID IN ({0}) OR pt.Project_ID IN ({0})
