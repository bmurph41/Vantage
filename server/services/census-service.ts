import type { DemographicSummary } from "@shared/schema";

interface CensusApiResponse {
  [key: string]: string | number;
}

interface GeographicCodes {
  state: string;
  county: string;
  tract: string;
  blockGroup: string;
}

export class CensusService {
  private apiKey: string;
  private baseUrl = "https://api.census.gov/data";

  constructor(apiKey?: string) {
    this.apiKey = apiKey || "";
  }

  async getDemographicsForLocation(latitude: number, longitude: number): Promise<DemographicSummary> {
    if (!this.apiKey) {
      console.log("Census API key not configured, using mock data");
      return CensusService.getMockDemographics(latitude, longitude);
    }

    try {
      const geoData = await this.getGeographicCodes(latitude, longitude);
      
      const [
        basicDemographics,
        incomeData,
        ageData,
        educationData,
        employmentData,
        housingData,
        raceData,
        industryData
      ] = await Promise.all([
        this.getBasicDemographics(geoData),
        this.getIncomeData(geoData),
        this.getAgeDistribution(geoData),
        this.getEducationData(geoData),
        this.getEmploymentData(geoData),
        this.getHousingData(geoData),
        this.getRaceEthnicityData(geoData),
        this.getIndustryData(geoData)
      ]);

      return {
        totalPopulation: this.parseNumber(basicDemographics.B01003_001E) || 0,
        totalMales: this.parseNumber(basicDemographics.B01001_002E) || 0,
        totalFemales: this.parseNumber(basicDemographics.B01001_026E) || 0,
        medianAge: this.parseNumber(basicDemographics.B01002_001E) || 0,
        medianAgeMale: this.parseNumber(basicDemographics.B01002_002E) || 0,
        medianAgeFemale: this.parseNumber(basicDemographics.B01002_003E) || 0,
        
        ageDistribution: this.formatAgeDistribution(ageData),
        ageByGender: this.formatAgeByGender(ageData),
        generationalCohorts: this.formatGenerationalCohorts(ageData),
        
        medianHouseholdIncome: this.parseNumber(incomeData.B19013_001E) || 0,
        meanHouseholdIncome: this.parseNumber(incomeData.B19025_001E) || 0,
        perCapitaIncome: this.parseNumber(incomeData.B19301_001E) || 0,
        medianFamilyIncome: this.parseNumber(incomeData.B19113_001E) || 0,
        incomeDistribution: this.formatIncomeDistribution(incomeData),
        
        educationLevels: this.formatEducationLevels(educationData),
        
        employmentStats: this.formatEmploymentStats(employmentData),
        industryDistribution: this.formatIndustryDistribution(industryData),
        
        housingStats: this.formatHousingStats(housingData),
        householdSize: this.parseNumber(basicDemographics.B25010_001E) || 2.5,
        medianHomeValue: this.parseNumber(housingData.B25077_001E) || 0,
        
        raceEthnicity: this.formatRaceEthnicity(raceData),
        
        populationDensity: this.calculatePopulationDensity(
          this.parseNumber(basicDemographics.B01003_001E),
          geoData
        ),
        
        geographicLevel: geoData.tract ? "tract" : geoData.county ? "county" : "state",
        fipsState: geoData.state,
        fipsCounty: geoData.county,
        fipsTract: geoData.tract
      };
    } catch (error) {
      console.error("Census API error:", error);
      return CensusService.getMockDemographics(latitude, longitude);
    }
  }

  private async getGeographicCodes(latitude: number, longitude: number): Promise<GeographicCodes> {
    const geocodeUrl = `https://geocoding.geo.census.gov/geocoder/geographies/coordinates`;
    const params = new URLSearchParams({
      x: longitude.toString(),
      y: latitude.toString(),
      benchmark: "Public_AR_Current",
      vintage: "Current_Current",
      format: "json"
    });

    const response = await fetch(`${geocodeUrl}?${params}`);
    if (!response.ok) {
      throw new Error(`Census geocoding failed: ${response.status}`);
    }

    const data = await response.json();
    const geographies = data.result?.geographies;
    
    if (!geographies) {
      throw new Error("No geographic data found for coordinates");
    }

    const state = geographies["States"]?.[0]?.STATE || "";
    const county = geographies["Counties"]?.[0]?.COUNTY || "";
    const tract = geographies["Census Tracts"]?.[0]?.TRACT || "";
    const blockGroup = geographies["Census Block Groups"]?.[0]?.BLKGRP || "";

    return { state, county, tract, blockGroup };
  }

  private async fetchCensusData(endpoint: string, variables: string[], geoData: GeographicCodes): Promise<CensusApiResponse> {
    const url = `${this.baseUrl}/${endpoint}`;
    
    if (!geoData.state) {
      throw new Error("Missing state geographic data");
    }
    
    const geoLevels = [
      geoData.tract && geoData.county ? {
        for: `tract:${geoData.tract}`,
        in: `state:${geoData.state} county:${geoData.county}`
      } : null,
      geoData.county ? {
        for: `county:${geoData.county}`,
        in: `state:${geoData.state}`
      } : null,
      {
        for: `state:${geoData.state}`,
        in: null
      }
    ].filter((level): level is NonNullable<typeof level> => level !== null);

    for (const geoLevel of geoLevels) {
      try {
        const params = new URLSearchParams({
          get: variables.join(","),
          key: this.apiKey
        });
        
        params.append('for', geoLevel.for);
        if (geoLevel.in) {
          params.append('in', geoLevel.in);
        }

        const response = await fetch(`${url}?${params}`);
        if (!response.ok) {
          continue;
        }

        const data = await response.json();
        
        if (!data || data.length < 2) {
          continue;
        }

        const headers = data[0];
        const values = data[1];
        
        const result: CensusApiResponse = {};
        headers.forEach((header: string, index: number) => {
          result[header] = values[index];
        });

        return result;
      } catch (error) {
        continue;
      }
    }
    
    throw new Error("Failed to fetch Census data at any geographic level");
  }

  private async getBasicDemographics(geoData: GeographicCodes): Promise<CensusApiResponse> {
    return this.fetchCensusData("2023/acs/acs5", [
      "B01003_001E",
      "B01001_002E",
      "B01001_026E",
      "B01002_001E",
      "B01002_002E",
      "B01002_003E",
      "B25010_001E"
    ], geoData);
  }

  private async getIncomeData(geoData: GeographicCodes): Promise<CensusApiResponse> {
    return this.fetchCensusData("2023/acs/acs5", [
      "B19013_001E",
      "B19025_001E",
      "B19301_001E",
      "B19113_001E",
      "B19001_002E",
      "B19001_003E",
      "B19001_004E",
      "B19001_005E",
      "B19001_006E",
      "B19001_007E",
      "B19001_008E",
      "B19001_009E",
      "B19001_010E",
      "B19001_011E",
      "B19001_012E",
      "B19001_013E",
      "B19001_014E",
      "B19001_015E",
      "B19001_016E",
      "B19001_017E"
    ], geoData);
  }

  private async getAgeDistribution(geoData: GeographicCodes): Promise<CensusApiResponse> {
    return this.fetchCensusData("2023/acs/acs5", [
      "B01001_001E",
      "B01001_003E", "B01001_004E", "B01001_005E", "B01001_006E",
      "B01001_007E", "B01001_008E", "B01001_009E", "B01001_010E", "B01001_011E", "B01001_012E",
      "B01001_013E", "B01001_014E", "B01001_015E", "B01001_016E",
      "B01001_017E", "B01001_018E", "B01001_019E",
      "B01001_020E", "B01001_021E", "B01001_022E", "B01001_023E", "B01001_024E", "B01001_025E",
      "B01001_027E", "B01001_028E", "B01001_029E", "B01001_030E",
      "B01001_031E", "B01001_032E", "B01001_033E", "B01001_034E", "B01001_035E", "B01001_036E",
      "B01001_037E", "B01001_038E", "B01001_039E", "B01001_040E",
      "B01001_041E", "B01001_042E", "B01001_043E",
      "B01001_044E", "B01001_045E", "B01001_046E", "B01001_047E", "B01001_048E", "B01001_049E"
    ], geoData);
  }

  private async getEducationData(geoData: GeographicCodes): Promise<CensusApiResponse> {
    return this.fetchCensusData("2023/acs/acs5", [
      "B15003_001E",
      "B15003_002E",
      "B15003_017E",
      "B15003_018E",
      "B15003_019E",
      "B15003_020E",
      "B15003_021E",
      "B15003_022E",
      "B15003_023E",
      "B15003_024E",
      "B15003_025E"
    ], geoData);
  }

  private async getEmploymentData(geoData: GeographicCodes): Promise<CensusApiResponse> {
    return this.fetchCensusData("2023/acs/acs5", [
      "B23025_001E",
      "B23025_002E",
      "B23025_003E",
      "B23025_004E",
      "B23025_005E",
      "B23025_007E"
    ], geoData);
  }

  private async getIndustryData(geoData: GeographicCodes): Promise<CensusApiResponse> {
    return this.fetchCensusData("2023/acs/acs5", [
      "C24010_001E",
      "C24010_003E",
      "C24010_019E",
      "C24010_033E",
      "C24010_043E",
      "C24010_045E",
      "C24010_047E",
      "C24010_049E",
      "C24010_051E",
      "C24010_055E",
      "C24010_057E",
      "C24010_059E",
      "C24010_061E",
      "C24010_063E"
    ], geoData);
  }

  private async getHousingData(geoData: GeographicCodes): Promise<CensusApiResponse> {
    return this.fetchCensusData("2023/acs/acs5", [
      "B25077_001E",
      "B25003_001E",
      "B25003_002E",
      "B25003_003E",
      "B25002_003E",
      "B25064_001E",
      "B25035_001E"
    ], geoData);
  }

  private async getRaceEthnicityData(geoData: GeographicCodes): Promise<CensusApiResponse> {
    return this.fetchCensusData("2023/acs/acs5", [
      "B02001_001E",
      "B02001_002E",
      "B02001_003E",
      "B02001_004E",
      "B02001_005E",
      "B02001_006E",
      "B02001_007E",
      "B02001_008E",
      "B03003_001E",
      "B03003_003E"
    ], geoData);
  }

  private parseNumber(value: any): number {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return isNaN(num) || num < 0 ? 0 : num;
  }

  private calculatePopulationDensity(population: number, geoData: GeographicCodes): number {
    if (population === 0) return 0;
    const estimatedAreaSqMiles = 1.5;
    return Math.round((population / estimatedAreaSqMiles) * 100) / 100;
  }

  private formatAgeDistribution(data: CensusApiResponse): Record<string, number> {
    const total = this.parseNumber(data.B01001_001E);
    if (total === 0) {
      return { under18: 0, "18to34": 0, "35to54": 0, "55to64": 0, over65: 0 };
    }

    const under18 = 
      this.parseNumber(data.B01001_003E) + this.parseNumber(data.B01001_004E) + 
      this.parseNumber(data.B01001_005E) + this.parseNumber(data.B01001_006E) +
      this.parseNumber(data.B01001_027E) + this.parseNumber(data.B01001_028E) + 
      this.parseNumber(data.B01001_029E) + this.parseNumber(data.B01001_030E);

    const age18to34 = 
      this.parseNumber(data.B01001_007E) + this.parseNumber(data.B01001_008E) + 
      this.parseNumber(data.B01001_009E) + this.parseNumber(data.B01001_010E) + 
      this.parseNumber(data.B01001_011E) + this.parseNumber(data.B01001_012E) +
      this.parseNumber(data.B01001_031E) + this.parseNumber(data.B01001_032E) + 
      this.parseNumber(data.B01001_033E) + this.parseNumber(data.B01001_034E) + 
      this.parseNumber(data.B01001_035E) + this.parseNumber(data.B01001_036E);

    const age35to54 = 
      this.parseNumber(data.B01001_013E) + this.parseNumber(data.B01001_014E) + 
      this.parseNumber(data.B01001_015E) + this.parseNumber(data.B01001_016E) +
      this.parseNumber(data.B01001_037E) + this.parseNumber(data.B01001_038E) + 
      this.parseNumber(data.B01001_039E) + this.parseNumber(data.B01001_040E);

    const age55to64 = 
      this.parseNumber(data.B01001_017E) + this.parseNumber(data.B01001_018E) + 
      this.parseNumber(data.B01001_019E) +
      this.parseNumber(data.B01001_041E) + this.parseNumber(data.B01001_042E) + 
      this.parseNumber(data.B01001_043E);

    const over65 = 
      this.parseNumber(data.B01001_020E) + this.parseNumber(data.B01001_021E) + 
      this.parseNumber(data.B01001_022E) + this.parseNumber(data.B01001_023E) + 
      this.parseNumber(data.B01001_024E) + this.parseNumber(data.B01001_025E) +
      this.parseNumber(data.B01001_044E) + this.parseNumber(data.B01001_045E) + 
      this.parseNumber(data.B01001_046E) + this.parseNumber(data.B01001_047E) + 
      this.parseNumber(data.B01001_048E) + this.parseNumber(data.B01001_049E);

    return {
      under18: Math.round((under18 / total) * 1000) / 10,
      "18to34": Math.round((age18to34 / total) * 1000) / 10,
      "35to54": Math.round((age35to54 / total) * 1000) / 10,
      "55to64": Math.round((age55to64 / total) * 1000) / 10,
      over65: Math.round((over65 / total) * 1000) / 10
    };
  }

  private formatAgeByGender(data: CensusApiResponse): Record<string, any> {
    return {
      male: {
        under18: this.parseNumber(data.B01001_003E) + this.parseNumber(data.B01001_004E) + 
                 this.parseNumber(data.B01001_005E) + this.parseNumber(data.B01001_006E),
        "18to34": this.parseNumber(data.B01001_007E) + this.parseNumber(data.B01001_008E) + 
                  this.parseNumber(data.B01001_009E) + this.parseNumber(data.B01001_010E) + 
                  this.parseNumber(data.B01001_011E) + this.parseNumber(data.B01001_012E),
        "35to54": this.parseNumber(data.B01001_013E) + this.parseNumber(data.B01001_014E) + 
                  this.parseNumber(data.B01001_015E) + this.parseNumber(data.B01001_016E),
        "55to64": this.parseNumber(data.B01001_017E) + this.parseNumber(data.B01001_018E) + 
                  this.parseNumber(data.B01001_019E),
        over65: this.parseNumber(data.B01001_020E) + this.parseNumber(data.B01001_021E) + 
                this.parseNumber(data.B01001_022E) + this.parseNumber(data.B01001_023E) + 
                this.parseNumber(data.B01001_024E) + this.parseNumber(data.B01001_025E)
      },
      female: {
        under18: this.parseNumber(data.B01001_027E) + this.parseNumber(data.B01001_028E) + 
                 this.parseNumber(data.B01001_029E) + this.parseNumber(data.B01001_030E),
        "18to34": this.parseNumber(data.B01001_031E) + this.parseNumber(data.B01001_032E) + 
                  this.parseNumber(data.B01001_033E) + this.parseNumber(data.B01001_034E) + 
                  this.parseNumber(data.B01001_035E) + this.parseNumber(data.B01001_036E),
        "35to54": this.parseNumber(data.B01001_037E) + this.parseNumber(data.B01001_038E) + 
                  this.parseNumber(data.B01001_039E) + this.parseNumber(data.B01001_040E),
        "55to64": this.parseNumber(data.B01001_041E) + this.parseNumber(data.B01001_042E) + 
                  this.parseNumber(data.B01001_043E),
        over65: this.parseNumber(data.B01001_044E) + this.parseNumber(data.B01001_045E) + 
                this.parseNumber(data.B01001_046E) + this.parseNumber(data.B01001_047E) + 
                this.parseNumber(data.B01001_048E) + this.parseNumber(data.B01001_049E)
      }
    };
  }

  private formatGenerationalCohorts(data: CensusApiResponse): Record<string, number> {
    const total = this.parseNumber(data.B01001_001E);
    if (total === 0) return { genZ: 0, millennials: 0, genX: 0, boomers: 0, silent: 0 };

    const ageByGender = this.formatAgeByGender(data);
    const under18 = ageByGender.male.under18 + ageByGender.female.under18;
    const age18to34 = ageByGender.male["18to34"] + ageByGender.female["18to34"];
    const age35to54 = ageByGender.male["35to54"] + ageByGender.female["35to54"];
    const age55to64 = ageByGender.male["55to64"] + ageByGender.female["55to64"];
    const over65 = ageByGender.male.over65 + ageByGender.female.over65;

    return {
      genZ: Math.round(((under18 + age18to34 * 0.3) / total) * 1000) / 10,
      millennials: Math.round((age18to34 * 0.7 / total) * 1000) / 10,
      genX: Math.round((age35to54 / total) * 1000) / 10,
      boomers: Math.round(((age55to64 + over65 * 0.5) / total) * 1000) / 10,
      silent: Math.round((over65 * 0.5 / total) * 1000) / 10
    };
  }

  private formatIncomeDistribution(data: CensusApiResponse): Record<string, number> {
    const total = 
      this.parseNumber(data.B19001_002E) + this.parseNumber(data.B19001_003E) +
      this.parseNumber(data.B19001_004E) + this.parseNumber(data.B19001_005E) +
      this.parseNumber(data.B19001_006E) + this.parseNumber(data.B19001_007E) +
      this.parseNumber(data.B19001_008E) + this.parseNumber(data.B19001_009E) +
      this.parseNumber(data.B19001_010E) + this.parseNumber(data.B19001_011E) +
      this.parseNumber(data.B19001_012E) + this.parseNumber(data.B19001_013E) +
      this.parseNumber(data.B19001_014E) + this.parseNumber(data.B19001_015E) +
      this.parseNumber(data.B19001_016E) + this.parseNumber(data.B19001_017E);

    if (total === 0) {
      return { under25k: 0, "25kto50k": 0, "50kto75k": 0, "75kto100k": 0, "100kto150k": 0, over150k: 0 };
    }

    const under25k = this.parseNumber(data.B19001_002E) + this.parseNumber(data.B19001_003E) + 
                     this.parseNumber(data.B19001_004E) + this.parseNumber(data.B19001_005E);
    const k25to50k = this.parseNumber(data.B19001_006E) + this.parseNumber(data.B19001_007E) + 
                     this.parseNumber(data.B19001_008E) + this.parseNumber(data.B19001_009E) + 
                     this.parseNumber(data.B19001_010E);
    const k50to75k = this.parseNumber(data.B19001_011E) + this.parseNumber(data.B19001_012E);
    const k75to100k = this.parseNumber(data.B19001_013E);
    const k100to150k = this.parseNumber(data.B19001_014E) + this.parseNumber(data.B19001_015E);
    const over150k = this.parseNumber(data.B19001_016E) + this.parseNumber(data.B19001_017E);

    return {
      under25k: Math.round((under25k / total) * 1000) / 10,
      "25kto50k": Math.round((k25to50k / total) * 1000) / 10,
      "50kto75k": Math.round((k50to75k / total) * 1000) / 10,
      "75kto100k": Math.round((k75to100k / total) * 1000) / 10,
      "100kto150k": Math.round((k100to150k / total) * 1000) / 10,
      over150k: Math.round((over150k / total) * 1000) / 10
    };
  }

  private formatEducationLevels(data: CensusApiResponse): Record<string, number> {
    const total = this.parseNumber(data.B15003_001E);
    if (total === 0) {
      return { lessThanHighSchool: 0, highSchool: 0, someCollege: 0, bachelors: 0, graduate: 0 };
    }

    const lessThanHighSchool = this.parseNumber(data.B15003_002E);
    const highSchool = this.parseNumber(data.B15003_017E) + this.parseNumber(data.B15003_018E);
    const someCollege = this.parseNumber(data.B15003_019E) + this.parseNumber(data.B15003_020E) + 
                        this.parseNumber(data.B15003_021E);
    const bachelors = this.parseNumber(data.B15003_022E);
    const graduate = this.parseNumber(data.B15003_023E) + this.parseNumber(data.B15003_024E) + 
                     this.parseNumber(data.B15003_025E);

    return {
      lessThanHighSchool: Math.round((lessThanHighSchool / total) * 1000) / 10,
      highSchool: Math.round((highSchool / total) * 1000) / 10,
      someCollege: Math.round((someCollege / total) * 1000) / 10,
      bachelors: Math.round((bachelors / total) * 1000) / 10,
      graduate: Math.round((graduate / total) * 1000) / 10
    };
  }

  private formatEmploymentStats(data: CensusApiResponse): Record<string, number> {
    const laborForce = this.parseNumber(data.B23025_002E);
    const employed = this.parseNumber(data.B23025_004E);
    const unemployed = this.parseNumber(data.B23025_005E);
    const notInLaborForce = this.parseNumber(data.B23025_007E);
    const total = this.parseNumber(data.B23025_001E);

    return {
      laborForceParticipation: total > 0 ? Math.round((laborForce / total) * 1000) / 10 : 0,
      employmentRate: laborForce > 0 ? Math.round((employed / laborForce) * 1000) / 10 : 0,
      unemploymentRate: laborForce > 0 ? Math.round((unemployed / laborForce) * 1000) / 10 : 0,
      employed,
      unemployed,
      notInLaborForce
    };
  }

  private formatIndustryDistribution(data: CensusApiResponse): Record<string, number> {
    const total = this.parseNumber(data.C24010_001E);
    if (total === 0) return {};

    return {
      agriculture: Math.round((this.parseNumber(data.C24010_003E) / total) * 1000) / 10,
      construction: Math.round((this.parseNumber(data.C24010_019E) / total) * 1000) / 10,
      manufacturing: Math.round((this.parseNumber(data.C24010_033E) / total) * 1000) / 10,
      wholesale: Math.round((this.parseNumber(data.C24010_043E) / total) * 1000) / 10,
      retail: Math.round((this.parseNumber(data.C24010_045E) / total) * 1000) / 10,
      transportation: Math.round((this.parseNumber(data.C24010_047E) / total) * 1000) / 10,
      information: Math.round((this.parseNumber(data.C24010_049E) / total) * 1000) / 10,
      finance: Math.round((this.parseNumber(data.C24010_051E) / total) * 1000) / 10,
      professional: Math.round((this.parseNumber(data.C24010_055E) / total) * 1000) / 10,
      education: Math.round((this.parseNumber(data.C24010_057E) / total) * 1000) / 10,
      arts: Math.round((this.parseNumber(data.C24010_059E) / total) * 1000) / 10,
      otherServices: Math.round((this.parseNumber(data.C24010_061E) / total) * 1000) / 10,
      publicAdmin: Math.round((this.parseNumber(data.C24010_063E) / total) * 1000) / 10
    };
  }

  private formatHousingStats(data: CensusApiResponse): Record<string, number> {
    const totalUnits = this.parseNumber(data.B25003_001E);
    const ownerOccupied = this.parseNumber(data.B25003_002E);
    const renterOccupied = this.parseNumber(data.B25003_003E);
    const vacant = this.parseNumber(data.B25002_003E);

    return {
      totalUnits,
      ownerOccupied: totalUnits > 0 ? Math.round((ownerOccupied / totalUnits) * 1000) / 10 : 0,
      renterOccupied: totalUnits > 0 ? Math.round((renterOccupied / totalUnits) * 1000) / 10 : 0,
      vacancyRate: totalUnits > 0 ? Math.round((vacant / totalUnits) * 1000) / 10 : 0,
      medianRent: this.parseNumber(data.B25064_001E),
      medianYearBuilt: this.parseNumber(data.B25035_001E)
    };
  }

  private formatRaceEthnicity(data: CensusApiResponse): Record<string, number> {
    const total = this.parseNumber(data.B02001_001E);
    if (total === 0) return {};

    return {
      white: Math.round((this.parseNumber(data.B02001_002E) / total) * 1000) / 10,
      black: Math.round((this.parseNumber(data.B02001_003E) / total) * 1000) / 10,
      americanIndian: Math.round((this.parseNumber(data.B02001_004E) / total) * 1000) / 10,
      asian: Math.round((this.parseNumber(data.B02001_005E) / total) * 1000) / 10,
      pacificIslander: Math.round((this.parseNumber(data.B02001_006E) / total) * 1000) / 10,
      otherRace: Math.round((this.parseNumber(data.B02001_007E) / total) * 1000) / 10,
      twoOrMore: Math.round((this.parseNumber(data.B02001_008E) / total) * 1000) / 10,
      hispanic: this.parseNumber(data.B03003_001E) > 0 
        ? Math.round((this.parseNumber(data.B03003_003E) / this.parseNumber(data.B03003_001E)) * 1000) / 10 
        : 0
    };
  }

  static getMockDemographics(latitude?: number, longitude?: number): DemographicSummary {
    const basePopulation = 45000 + Math.floor(Math.random() * 30000);
    const medianIncome = 55000 + Math.floor(Math.random() * 40000);
    
    return {
      totalPopulation: basePopulation,
      totalMales: Math.floor(basePopulation * 0.49),
      totalFemales: Math.floor(basePopulation * 0.51),
      medianAge: 36 + Math.floor(Math.random() * 10),
      medianAgeMale: 35 + Math.floor(Math.random() * 10),
      medianAgeFemale: 37 + Math.floor(Math.random() * 10),
      
      ageDistribution: {
        under18: 22.5,
        "18to34": 24.3,
        "35to54": 26.1,
        "55to64": 12.8,
        over65: 14.3
      },
      ageByGender: {
        male: { under18: 5100, "18to34": 5500, "35to54": 5900, "55to64": 2900, over65: 3200 },
        female: { under18: 5000, "18to34": 5400, "35to54": 5800, "55to64": 2800, over65: 3400 }
      },
      generationalCohorts: {
        genZ: 28.5,
        millennials: 22.1,
        genX: 26.1,
        boomers: 18.2,
        silent: 5.1
      },
      
      medianHouseholdIncome: medianIncome,
      meanHouseholdIncome: Math.floor(medianIncome * 1.25),
      perCapitaIncome: Math.floor(medianIncome / 2.1),
      medianFamilyIncome: Math.floor(medianIncome * 1.15),
      incomeDistribution: {
        under25k: 15.2,
        "25kto50k": 22.1,
        "50kto75k": 20.5,
        "75kto100k": 15.3,
        "100kto150k": 14.8,
        over150k: 12.1
      },
      
      educationLevels: {
        lessThanHighSchool: 8.5,
        highSchool: 25.2,
        someCollege: 28.3,
        bachelors: 24.1,
        graduate: 13.9
      },
      
      employmentStats: {
        laborForceParticipation: 64.5,
        employmentRate: 95.2,
        unemploymentRate: 4.8,
        employed: 29000,
        unemployed: 1400,
        notInLaborForce: 15600
      },
      industryDistribution: {
        agriculture: 1.2,
        construction: 6.5,
        manufacturing: 8.3,
        wholesale: 2.8,
        retail: 11.2,
        transportation: 4.5,
        information: 2.1,
        finance: 6.8,
        professional: 12.5,
        education: 23.4,
        arts: 9.8,
        otherServices: 4.9,
        publicAdmin: 6.0
      },
      
      housingStats: {
        totalUnits: 18500,
        ownerOccupied: 62.5,
        renterOccupied: 37.5,
        vacancyRate: 6.2,
        medianRent: 1250,
        medianYearBuilt: 1985
      },
      householdSize: 2.45,
      medianHomeValue: 285000 + Math.floor(Math.random() * 150000),
      
      raceEthnicity: {
        white: 68.5,
        black: 12.3,
        americanIndian: 0.8,
        asian: 6.2,
        pacificIslander: 0.3,
        otherRace: 5.8,
        twoOrMore: 6.1,
        hispanic: 18.5
      },
      
      populationDensity: Math.floor(basePopulation / 15),
      geographicLevel: "tract",
      fipsState: "12",
      fipsCounty: "086",
      fipsTract: "001200"
    };
  }
}
