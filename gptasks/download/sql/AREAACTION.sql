SELECT
  AreaActionID,
  a.FeatureID,
  a.ActionDescription
FROM AREAACTION a

LEFT JOIN POLY p
ON a.FeatureID = p.FeatureID
LEFT JOIN LINE l
ON a.FeatureID = l.FeatureID
LEFT JOIN POINT pt
ON a.FeatureID = pt.FeatureID

WHERE p.Project_ID IN ({0}) OR l.Project_ID IN ({0}) OR pt.Project_ID IN ({0})
