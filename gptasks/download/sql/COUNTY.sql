SELECT
  CountyInfoID,
  c.FeatureID,
  c.FeatureClass,
  CONCAT(c.FeatureClass, ':', c.FeatureID) as Composite_Key,
  County_ID,
  County,
  Intersection
FROM COUNTY c

LEFT JOIN POLY p
ON c.FeatureID = p.FeatureID AND c.FeatureClass = 'POLY'
LEFT JOIN LINE l
ON c.FeatureID = l.FeatureID AND c.FeatureClass = 'LINE'
LEFT JOIN POINT pt
ON c.FeatureID = pt.FeatureID AND c.FeatureClass = 'POINT'

WHERE p.Project_ID IN ({0}) OR l.Project_ID IN ({0}) OR pt.Project_ID IN ({0})
