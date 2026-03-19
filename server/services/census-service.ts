import type { DemographicSummary } from "@shared/schema";
import { createChildLogger } from "../lib/logger";

const logger = createChildLogger({ module: 'census-service' });

interface CensusApiResponse {
  [key: string]: string | number;
}

interface GeographicCodes {
  state: string;
  county: string;
  tract: string;
  blockGroup: string;
}

interface SamplePoint {
  lat: number;
  lng: number;
  weight: number;
}

export class CensusService {
  private apiKey: string;
  private baseUrl = "https://api.census.gov/data";

  constructor(apiKey?: string) {
    this.apiKey = apiKey || "";
  }

  async getDemographicsForRadius(
    centerLat: number,
    centerLng: number,
    radiusMiles: number
  ): Promise<DemographicSummary> {
    if (!this.apiKey) {
      logger.debug({ centerLat, centerLng }, "Census API key not configured, using mock data for radius query");
      return CensusService.getMockDemographics(centerLat, centerLng);
    }

    try {
      const samplePoints = this.generateSamplePoints(centerLat, centerLng, radiusMiles);
      
      const uniqueTracts = new Map<string, { geoData: GeographicCodes; weight: number }>();
      
      for (const point of samplePoints) {
        try {
          const geoData = await this.getGeographicCodes(point.lat, point.lng);
          const tractKey = `${geoData.state}-${geoData.county}-${geoData.tract}`;
          
          if (!uniqueTracts.has(tractKey)) {
            uniqueTracts.set(tractKey, { geoData, weight: point.weight });
          } else {
            const existing = uniqueTracts.get(tractKey)!;
            existing.weight += point.weight;
          }
        } catch (e) {
        }
      }

      if (uniqueTracts.size === 0) {
        return this.getDemographicsForLocation(centerLat, centerLng);
      }

      if (uniqueTracts.size === 1) {
        const [{ geoData }] = Array.from(uniqueTracts.values());
        return this.fetchDemographicsForGeoData(geoData);
      }

      const tractDemographics: Array<{ demographics: DemographicSummary; weight: number }> = [];
      
      for (const [, { geoData, weight }] of uniqueTracts) {
        try {
          const demographics = await this.fetchDemographicsForGeoData(geoData);
          tractDemographics.push({ demographics, weight });
        } catch (e) {
        }
      }

      if (tractDemographics.length === 0) {
        return this.getDemographicsForLocation(centerLat, centerLng);
      }

      const areaSqMiles = Math.PI * radiusMiles * radiusMiles;
      return this.aggregateDemographics(tractDemographics, areaSqMiles);
    } catch (error) {
      console.error("Census radius query error:", error);
      return this.getDemographicsForLocation(centerLat, centerLng);
    }
  }

  private generateSamplePoints(centerLat: number, centerLng: number, radiusMiles: number): SamplePoint[] {
    const points: SamplePoint[] = [{ lat: centerLat, lng: centerLng, weight: 2 }];
    
    const milesPerDegreeLat = 69.0;
    const milesPerDegreeLng = 69.0 * Math.cos(centerLat * Math.PI / 180);
    
    const numRings = radiusMiles <= 1 ? 1 : radiusMiles <= 3 ? 2 : 3;
    const pointsPerRing = radiusMiles <= 1 ? 4 : 8;
    
    for (let ring = 1; ring <= numRings; ring++) {
      const ringRadius = (radiusMiles / numRings) * ring;
      const weight = 1 / ring;
      
      for (let i = 0; i < pointsPerRing; i++) {
        const angle = (2 * Math.PI * i) / pointsPerRing;
        const latOffset = (ringRadius / milesPerDegreeLat) * Math.cos(angle);
        const lngOffset = (ringRadius / milesPerDegreeLng) * Math.sin(angle);
        
        points.push({
          lat: centerLat + latOffset,
          lng: centerLng + lngOffset,
          weight
        });
      }
    }
    
    return points;
  }

  private async fetchDemographicsForGeoData(geoData: GeographicCodes): Promise<DemographicSummary> {
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
      
      totalHouseholds: this.parseNumber(basicDemographics.B11001_001E) || 0,
      aggregateHouseholdIncome: (this.parseNumber(basicDemographics.B11001_001E) || 0) *
        (this.parseNumber(incomeData.B19013_001E) || 0),

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
  }

  private aggregateDemographics(tractData: Array<{ demographics: DemographicSummary; weight: number }>, areaSqMiles?: number): DemographicSummary {
    const totalPopulation = tractData.reduce((sum, t) => sum + (t.demographics.totalPopulation || 0), 0);
    
    const sumCounts = (getValue: (d: DemographicSummary) => number | undefined): number => {
      return tractData.reduce((sum, { demographics }) => sum + (getValue(demographics) || 0), 0);
    };

    const popWeightedAvg = (getValue: (d: DemographicSummary) => number | undefined): number => {
      if (totalPopulation === 0) return 0;
      let sum = 0;
      for (const { demographics } of tractData) {
        const value = getValue(demographics);
        const pop = demographics.totalPopulation || 0;
        if (value !== undefined && value > 0) {
          sum += value * pop;
        }
      }
      return Math.round((sum / totalPopulation) * 100) / 100;
    };

    const aggregatePercentageDistribution = (
      getDistribution: (d: DemographicSummary) => Record<string, number> | undefined
    ): Record<string, number> => {
      const result: Record<string, number> = {};
      if (totalPopulation === 0) return result;
      
      for (const { demographics } of tractData) {
        const dist = getDistribution(demographics);
        const pop = demographics.totalPopulation || 0;
        if (!dist || !pop) continue;
        
        for (const [key, value] of Object.entries(dist)) {
          if (typeof value === 'number') {
            result[key] = (result[key] || 0) + value * pop;
          }
        }
      }
      
      for (const key of Object.keys(result)) {
        result[key] = Math.round((result[key] / totalPopulation) * 100) / 100;
      }
      
      return result;
    };

    const aggregateAgeByGender = (): { male: Record<string, number>; female: Record<string, number> } | undefined => {
      const firstData = tractData[0]?.demographics.ageByGender;
      if (!firstData) return undefined;
      
      const male: Record<string, number> = {};
      const female: Record<string, number> = {};
      
      for (const { demographics } of tractData) {
        const ageData = demographics.ageByGender;
        if (!ageData) continue;
        
        if (ageData.male) {
          for (const [key, value] of Object.entries(ageData.male)) {
            if (typeof value === 'number') {
              male[key] = (male[key] || 0) + value;
            }
          }
        }
        
        if (ageData.female) {
          for (const [key, value] of Object.entries(ageData.female)) {
            if (typeof value === 'number') {
              female[key] = (female[key] || 0) + value;
            }
          }
        }
      }
      
      return { male, female };
    };

    const aggregateHousingStats = (): Record<string, number> | undefined => {
      const firstStats = tractData[0]?.demographics.housingStats;
      if (!firstStats) return undefined;
      
      const result: Record<string, number> = {};
      let totalUnits = 0;
      
      for (const { demographics } of tractData) {
        const stats = demographics.housingStats;
        if (!stats) continue;
        
        const units = stats.totalUnits || 0;
        totalUnits += units;
        
        for (const [key, value] of Object.entries(stats)) {
          if (typeof value === 'number') {
            if (key === 'totalUnits') {
              result[key] = (result[key] || 0) + value;
            } else {
              result[key] = (result[key] || 0) + value * units;
            }
          }
        }
      }
      
      if (totalUnits > 0) {
        for (const key of Object.keys(result)) {
          if (key !== 'totalUnits') {
            result[key] = Math.round((result[key] / totalUnits) * 100) / 100;
          }
        }
      }
      
      return result;
    };

    const aggregateEmploymentStats = (): Record<string, number> | undefined => {
      const firstStats = tractData[0]?.demographics.employmentStats;
      if (!firstStats) return undefined;
      
      const result: Record<string, number> = {};
      let totalLaborForce = 0;
      
      for (const { demographics } of tractData) {
        const stats = demographics.employmentStats;
        if (!stats) continue;
        
        const laborForce = (stats.employed || 0) + (stats.unemployed || 0);
        totalLaborForce += laborForce;
        
        for (const [key, value] of Object.entries(stats)) {
          if (typeof value === 'number') {
            if (['employed', 'unemployed', 'notInLaborForce'].includes(key)) {
              result[key] = (result[key] || 0) + value;
            } else {
              result[key] = (result[key] || 0) + value * laborForce;
            }
          }
        }
      }
      
      if (totalLaborForce > 0) {
        for (const key of Object.keys(result)) {
          if (!['employed', 'unemployed', 'notInLaborForce'].includes(key)) {
            result[key] = Math.round((result[key] / totalLaborForce) * 100) / 100;
          }
        }
      }
      
      return result;
    };

    return {
      totalPopulation,
      totalMales: sumCounts(d => d.totalMales),
      totalFemales: sumCounts(d => d.totalFemales),
      medianAge: popWeightedAvg(d => d.medianAge),
      medianAgeMale: popWeightedAvg(d => d.medianAgeMale),
      medianAgeFemale: popWeightedAvg(d => d.medianAgeFemale),
      
      ageDistribution: aggregatePercentageDistribution(d => d.ageDistribution),
      ageByGender: aggregateAgeByGender(),
      generationalCohorts: aggregatePercentageDistribution(d => d.generationalCohorts),
      
      medianHouseholdIncome: popWeightedAvg(d => d.medianHouseholdIncome),
      meanHouseholdIncome: popWeightedAvg(d => d.meanHouseholdIncome),
      perCapitaIncome: popWeightedAvg(d => d.perCapitaIncome),
      medianFamilyIncome: popWeightedAvg(d => d.medianFamilyIncome),
      incomeDistribution: aggregatePercentageDistribution(d => d.incomeDistribution),
      
      educationLevels: aggregatePercentageDistribution(d => d.educationLevels),
      
      employmentStats: aggregateEmploymentStats(),
      industryDistribution: aggregatePercentageDistribution(d => d.industryDistribution),
      
      totalHouseholds: sumCounts(d => d.totalHouseholds),
      aggregateHouseholdIncome: sumCounts(d => d.totalHouseholds) *
        popWeightedAvg(d => d.medianHouseholdIncome),

      housingStats: aggregateHousingStats(),
      householdSize: popWeightedAvg(d => d.householdSize),
      medianHomeValue: popWeightedAvg(d => d.medianHomeValue),

      raceEthnicity: aggregatePercentageDistribution(d => d.raceEthnicity),

      populationDensity: areaSqMiles && areaSqMiles > 0
        ? Math.round(totalPopulation / areaSqMiles)
        : undefined,

      geographicLevel: "aggregated",
      fipsState: tractData[0]?.demographics.fipsState,
      fipsCounty: tractData[0]?.demographics.fipsCounty,
      fipsTract: undefined
    };
  }

  async getDemographicsForLocation(latitude: number, longitude: number): Promise<DemographicSummary> {
    if (!this.apiKey) {
      logger.debug({ latitude, longitude }, "Census API key not configured, using mock data");
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
        
        totalHouseholds: this.parseNumber(basicDemographics.B11001_001E) || 0,
        aggregateHouseholdIncome: (this.parseNumber(basicDemographics.B11001_001E) || 0) *
          (this.parseNumber(incomeData.B19013_001E) || 0),

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
      "B25010_001E",
      "B11001_001E"  // Total households
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

  async getHistoricalTrends(
    latitude: number,
    longitude: number,
    radiusMiles?: number
  ): Promise<{
    trends: Array<{ year: number; population: number; medianIncome: number; medianHomeValue: number; unemploymentRate: number; totalHouseholds: number }>;
    cagr: { population: number; income: number; homeValue: number };
    geographicLevel: string;
  }> {
    if (!this.apiKey) {
      logger.debug({ latitude, longitude }, "Census API key not configured, returning empty historical trends");
      return { trends: [], cagr: { population: 0, income: 0, homeValue: 0 }, geographicLevel: 'unknown' };
    }

    try {
      const geoData = await this.getGeographicCodes(latitude, longitude);
      const years = [2019, 2020, 2021, 2022, 2023];
      const variables = ["B01003_001E", "B19013_001E", "B25077_001E", "B23025_003E", "B23025_005E", "B11001_001E"];

      const trends: Array<{ year: number; population: number; medianIncome: number; medianHomeValue: number; unemploymentRate: number; totalHouseholds: number }> = [];
      let geographicLevel = 'unknown';

      for (const year of years) {
        try {
          const { data, level } = await this.fetchHistoricalYearData(year, variables, geoData);
          if (data) {
            if (geographicLevel === 'unknown') geographicLevel = level;
            const population = this.parseNumber(data.B01003_001E) || 0;
            const medianIncome = this.parseNumber(data.B19013_001E) || 0;
            const medianHomeValue = this.parseNumber(data.B25077_001E) || 0;
            const laborForce = this.parseNumber(data.B23025_003E) || 0;
            const unemployed = this.parseNumber(data.B23025_005E) || 0;
            const unemploymentRate = laborForce > 0 ? Math.round((unemployed / laborForce) * 1000) / 10 : 0;
            const totalHouseholds = this.parseNumber(data.B11001_001E) || 0;

            trends.push({ year, population, medianIncome, medianHomeValue, unemploymentRate, totalHouseholds });
          }
        } catch (e) {
          logger.debug({ year, error: e }, "Failed to fetch historical data for year");
        }
      }

      // Compute 5-year CAGR
      const cagr = { population: 0, income: 0, homeValue: 0 };
      if (trends.length >= 2) {
        const first = trends[0];
        const last = trends[trends.length - 1];
        const years = last.year - first.year;
        if (years > 0) {
          const calcCagr = (start: number, end: number) =>
            start > 0 ? (Math.pow(end / start, 1 / years) - 1) * 100 : 0;
          cagr.population = Math.round(calcCagr(first.population, last.population) * 100) / 100;
          cagr.income = Math.round(calcCagr(first.medianIncome, last.medianIncome) * 100) / 100;
          cagr.homeValue = Math.round(calcCagr(first.medianHomeValue, last.medianHomeValue) * 100) / 100;
        }
      }

      return { trends, cagr, geographicLevel };
    } catch (error) {
      logger.error({ error }, "Failed to fetch historical trends");
      return { trends: [], cagr: { population: 0, income: 0, homeValue: 0 }, geographicLevel: 'unknown' };
    }
  }

  private async fetchHistoricalYearData(
    year: number,
    variables: string[],
    geoData: GeographicCodes
  ): Promise<{ data: CensusApiResponse | null; level: string }> {
    const endpoint = `${year}/acs/acs5`;
    const url = `${this.baseUrl}/${endpoint}`;

    const geoLevels = [
      // Try tract level first (most granular)
      geoData.tract && geoData.county ? {
        for: `tract:${geoData.tract}`,
        in: `state:${geoData.state} county:${geoData.county}`,
        level: 'tract'
      } : null,
      geoData.county ? {
        for: `county:${geoData.county}`,
        in: `state:${geoData.state}`,
        level: 'county'
      } : null,
      {
        for: `state:${geoData.state}`,
        in: null as string | null,
        level: 'state'
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
        if (!response.ok) continue;

        const data = await response.json();
        if (!data || data.length < 2) continue;

        const headers = data[0];
        const values = data[1];
        const result: CensusApiResponse = {};
        headers.forEach((header: string, index: number) => {
          result[header] = values[index];
        });

        return { data: result, level: geoLevel.level };
      } catch (error) {
        continue;
      }
    }

    return { data: null, level: 'unknown' };
  }

  async getBusinessPatterns(
    stateFips: string,
    countyFips: string
  ): Promise<{
    totalEstablishments: number;
    totalEmployees: number;
    totalPayroll: number;
    sectors: Array<{ naicsCode: string; name: string; establishments: number; employees: number; payroll: number }>;
  }> {
    if (!this.apiKey) {
      logger.debug("Census API key not configured, returning empty business patterns");
      return { totalEstablishments: 0, totalEmployees: 0, totalPayroll: 0, sectors: [] };
    }

    const naicsSectors: Record<string, string> = {
      "00": "Total",
      "44-45": "Retail Trade",
      "72": "Accommodation and Food Services",
      "71": "Arts, Entertainment, Recreation",
      "23": "Construction",
      "48-49": "Transportation/Warehousing",
      "52": "Finance/Insurance",
      "53": "Real Estate",
      "62": "Health Care",
      "31-33": "Manufacturing"
    };

    try {
      const url = `${this.baseUrl}/2022/cbp`;
      const variables = ["ESTAB", "EMP", "PAYANN", "NAICS2017"];
      const params = new URLSearchParams({
        get: variables.join(","),
        key: this.apiKey
      });
      params.append('for', `county:${countyFips}`);
      params.append('in', `state:${stateFips}`);

      const response = await fetch(`${url}?${params}`);
      if (!response.ok) {
        throw new Error(`CBP API request failed: ${response.status}`);
      }

      const data = await response.json();
      if (!data || data.length < 2) {
        throw new Error("No CBP data returned");
      }

      const headers: string[] = data[0];
      const rows: string[][] = data.slice(1);

      const estabIdx = headers.indexOf("ESTAB");
      const empIdx = headers.indexOf("EMP");
      const payannIdx = headers.indexOf("PAYANN");
      const naicsIdx = headers.indexOf("NAICS2017");

      let totalEstablishments = 0;
      let totalEmployees = 0;
      let totalPayroll = 0;
      const sectors: Array<{ naicsCode: string; name: string; establishments: number; employees: number; payroll: number }> = [];

      for (const row of rows) {
        const naicsCode = row[naicsIdx];
        if (!naicsSectors[naicsCode]) continue;

        const establishments = this.parseNumber(row[estabIdx]) || 0;
        const employees = this.parseNumber(row[empIdx]) || 0;
        const payroll = this.parseNumber(row[payannIdx]) || 0;

        if (naicsCode === "00") {
          totalEstablishments = establishments;
          totalEmployees = employees;
          totalPayroll = payroll;
        } else {
          sectors.push({
            naicsCode,
            name: naicsSectors[naicsCode],
            establishments,
            employees,
            payroll
          });
        }
      }

      return { totalEstablishments, totalEmployees, totalPayroll, sectors };
    } catch (error) {
      logger.error({ error }, "Failed to fetch business patterns");
      return { totalEstablishments: 0, totalEmployees: 0, totalPayroll: 0, sectors: [] };
    }
  }

  /**
   * Get demographics for an arbitrary polygon area (e.g., drive-time isochrone).
   * Generates a grid of sample points within the polygon, resolves each to a
   * census tract, and aggregates with population weighting.
   */
  async getDemographicsForPolygon(
    boundaryPoints: Array<{ lat: number; lng: number }>,
    areaSqMiles: number
  ): Promise<DemographicSummary> {
    if (!this.apiKey) {
      const center = this.polygonCentroid(boundaryPoints);
      return CensusService.getMockDemographics(center.lat, center.lng);
    }

    try {
      // Import point-in-polygon helper
      const { pointInPolygon } = await import('./drivetime-service');

      // Compute bounding box
      let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
      for (const p of boundaryPoints) {
        if (p.lat < minLat) minLat = p.lat;
        if (p.lat > maxLat) maxLat = p.lat;
        if (p.lng < minLng) minLng = p.lng;
        if (p.lng > maxLng) maxLng = p.lng;
      }

      // Generate grid at ~0.5 mile spacing
      const stepLat = 0.5 / 69.0;
      const center = this.polygonCentroid(boundaryPoints);
      const stepLng = 0.5 / (69.0 * Math.cos(center.lat * Math.PI / 180));

      const gridPoints: Array<{ lat: number; lng: number; weight: number }> = [];
      for (let lat = minLat; lat <= maxLat; lat += stepLat) {
        for (let lng = minLng; lng <= maxLng; lng += stepLng) {
          const point = { lat, lng };
          if (pointInPolygon(point, boundaryPoints)) {
            // Weight by inverse distance from center
            const dLat = (lat - center.lat) * 69;
            const dLng = (lng - center.lng) * 69 * Math.cos(center.lat * Math.PI / 180);
            const dist = Math.sqrt(dLat * dLat + dLng * dLng);
            const weight = 1 / (1 + dist * 0.5);
            gridPoints.push({ lat, lng, weight });
          }
        }
      }

      if (gridPoints.length === 0) {
        return this.getDemographicsForLocation(center.lat, center.lng);
      }

      // Resolve grid points to census tracts (concurrency-limited)
      const uniqueTracts = new Map<string, { geoData: GeographicCodes; weight: number }>();
      const CONCURRENCY = 10;

      for (let i = 0; i < gridPoints.length; i += CONCURRENCY) {
        const batch = gridPoints.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          batch.map(p => this.getGeographicCodes(p.lat, p.lng))
        );
        for (let j = 0; j < results.length; j++) {
          const result = results[j];
          if (result.status !== 'fulfilled') continue;
          const geoData = result.value;
          const tractKey = `${geoData.state}-${geoData.county}-${geoData.tract}`;
          const existing = uniqueTracts.get(tractKey);
          if (existing) {
            existing.weight += batch[j].weight;
          } else {
            uniqueTracts.set(tractKey, { geoData, weight: batch[j].weight });
          }
        }
      }

      if (uniqueTracts.size === 0) {
        return this.getDemographicsForLocation(center.lat, center.lng);
      }

      // Fetch demographics for each unique tract
      const tractDemographics: Array<{ demographics: DemographicSummary; weight: number }> = [];
      for (const [, { geoData, weight }] of uniqueTracts) {
        try {
          const demographics = await this.fetchDemographicsForGeoData(geoData);
          tractDemographics.push({ demographics, weight });
        } catch (e) {
          // Skip failed tracts
        }
      }

      if (tractDemographics.length === 0) {
        return this.getDemographicsForLocation(center.lat, center.lng);
      }

      return this.aggregateDemographics(tractDemographics, areaSqMiles);
    } catch (error) {
      console.error("Census polygon query error:", error);
      const center = this.polygonCentroid(boundaryPoints);
      return this.getDemographicsForLocation(center.lat, center.lng);
    }
  }

  private polygonCentroid(points: Array<{ lat: number; lng: number }>): { lat: number; lng: number } {
    const n = points.length;
    const sumLat = points.reduce((s, p) => s + p.lat, 0);
    const sumLng = points.reduce((s, p) => s + p.lng, 0);
    return { lat: sumLat / n, lng: sumLng / n };
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
