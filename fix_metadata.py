import re

with open('src/data/officialDutyRatioMatrix.ts', 'r') as f:
    content = f.read()

bad_metadata = """        flightTargets: m.flightTargets,
        isDisabled: m.isDisabled,
        totalRequiredDaily: m.totalRequiredDaily
    }));"""

good_metadata = """        flightTargets: m.flightTargets,
        isDisabled: m.isDisabled,
        totalRequiredDaily: m.totalRequiredDaily,
        dailyRequirements: m.dailyRequirements
    }));"""

content = content.replace(bad_metadata, good_metadata)

with open('src/data/officialDutyRatioMatrix.ts', 'w') as f:
    f.write(content)

