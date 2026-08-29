/**
 * Master data: regions, cities, facilities, chambers/locations, depositors.
 *
 * Every figure is derived from an explicit, checked-in snapshot rather than
 * generated at random, so the demo tells the same story every time.
 *
 * The network snapshot below reproduces the legacy daily report's published
 * figures (162,281 capacity / 135,104 occupied / 83.25% utilization) as the
 * prototype's opening state. They are DEMO SNAPSHOT VALUES, not constants:
 * they live here in the data layer, are reconciled bottom-up from facility
 * rows, and nothing in the UI reads them directly.
 */

import type {
  City,
  Customer,
  ExecutionId,
  Facility,
  FacilityType,
  OwnershipModel,
  Region,
  RegionId,
  StorageLocation,
  TemperatureZoneId,
} from '@/lib/domain/types'
import { allocateInteger, rngFor } from './seed'

export const REGION_ORDER: RegionId[] = ['NORTH', 'EAST', 'WEST-1', 'WEST-2', 'SOUTH-1', 'SOUTH-2']

export const REGIONS: Region[] = [
  { id: 'NORTH', name: 'North', lat: 28.7, lng: 77.2, head: 'Rajeev Malhotra' },
  { id: 'EAST', name: 'East', lat: 23.5, lng: 87.4, head: 'Soumitra Ganguly' },
  { id: 'WEST-1', name: 'West-1', lat: 19.6, lng: 73.0, head: 'Meher Contractor' },
  { id: 'WEST-2', name: 'West-2', lat: 22.0, lng: 78.2, head: 'Ashwin Deshmukh' },
  { id: 'SOUTH-1', name: 'South-1', lat: 15.1, lng: 80.4, head: 'Lakshmi Narayanan' },
  { id: 'SOUTH-2', name: 'South-2', lat: 12.4, lng: 76.4, head: 'Vinay Kamath' },
]

export const REGION_BY_ID: Record<RegionId, Region> = Object.fromEntries(
  REGIONS.map((r) => [r.id, r]),
) as Record<RegionId, Region>

export const TEMPERATURE_ZONES: { id: TemperatureZoneId; name: string; setPoint: string }[] = [
  { id: 'FROZEN', name: 'Frozen', setPoint: '-18°C to -22°C' },
  { id: 'CHILLED', name: 'Chilled', setPoint: '0°C to +4°C' },
  { id: 'CONTROLLED_AMBIENT', name: 'Controlled Ambient', setPoint: '+15°C to +25°C' },
  { id: 'AMBIENT', name: 'Ambient', setPoint: 'Uncontrolled' },
]

export const ZONE_BY_ID = Object.fromEntries(TEMPERATURE_ZONES.map((z) => [z.id, z])) as Record<
  TemperatureZoneId,
  { id: TemperatureZoneId; name: string; setPoint: string }
>

export const FACILITY_TYPE_LABEL: Record<FacilityType, string> = {
  DISTRIBUTION_CENTRE: 'Distribution Centre',
  FORWARD_COLD_DEPOT: 'Forward Cold Depot (FCD)',
  CROSS_DOCK: 'Cross Dock',
  PARK_AND_PAY: 'Park & Pay Yard',
}

export const OWNERSHIP_LABEL: Record<OwnershipModel, string> = {
  OWNED: 'Owned',
  LEASED: 'Leased',
  DEDICATED: 'Dedicated',
}

export const EXECUTION_LABEL: Record<ExecutionId, string> = {
  SNOWMAN_OWN: 'Snowman Own',
  PARTNER_OPERATED: 'Partner Operated',
  CUSTOMER_DEDICATED: 'Customer Dedicated',
}

// ---------------------------------------------------------------------------
// Cities
// ---------------------------------------------------------------------------

export const CITIES: City[] = [
  // NORTH
  { id: 'kundli', name: 'Kundli', state: 'Haryana', regionId: 'NORTH', lat: 29.0, lng: 77.1 },
  { id: 'palwal', name: 'Palwal', state: 'Haryana', regionId: 'NORTH', lat: 28.15, lng: 77.33 },
  { id: 'ghaziabad', name: 'Ghaziabad', state: 'Uttar Pradesh', regionId: 'NORTH', lat: 28.67, lng: 77.45 },
  { id: 'lucknow', name: 'Lucknow', state: 'Uttar Pradesh', regionId: 'NORTH', lat: 26.85, lng: 80.95 },
  { id: 'jaipur', name: 'Jaipur', state: 'Rajasthan', regionId: 'NORTH', lat: 26.91, lng: 75.79 },
  { id: 'ludhiana', name: 'Ludhiana', state: 'Punjab', regionId: 'NORTH', lat: 30.9, lng: 75.86 },
  { id: 'chandigarh', name: 'Chandigarh', state: 'Chandigarh', regionId: 'NORTH', lat: 30.73, lng: 76.78 },
  { id: 'dehradun', name: 'Dehradun', state: 'Uttarakhand', regionId: 'NORTH', lat: 30.32, lng: 78.03 },
  // EAST
  { id: 'kolkata', name: 'Kolkata', state: 'West Bengal', regionId: 'EAST', lat: 22.57, lng: 88.36 },
  { id: 'dankuni', name: 'Dankuni', state: 'West Bengal', regionId: 'EAST', lat: 22.68, lng: 88.29 },
  { id: 'siliguri', name: 'Siliguri', state: 'West Bengal', regionId: 'EAST', lat: 26.73, lng: 88.4 },
  { id: 'guwahati', name: 'Guwahati', state: 'Assam', regionId: 'EAST', lat: 26.14, lng: 91.74 },
  { id: 'patna', name: 'Patna', state: 'Bihar', regionId: 'EAST', lat: 25.59, lng: 85.14 },
  { id: 'bhubaneswar', name: 'Bhubaneswar', state: 'Odisha', regionId: 'EAST', lat: 20.3, lng: 85.82 },
  { id: 'ranchi', name: 'Ranchi', state: 'Jharkhand', regionId: 'EAST', lat: 23.34, lng: 85.31 },
  // WEST-1
  { id: 'bhiwandi', name: 'Bhiwandi', state: 'Maharashtra', regionId: 'WEST-1', lat: 19.3, lng: 73.06 },
  { id: 'palghar', name: 'Palghar', state: 'Maharashtra', regionId: 'WEST-1', lat: 19.7, lng: 72.77 },
  { id: 'taloja', name: 'Taloja', state: 'Maharashtra', regionId: 'WEST-1', lat: 19.08, lng: 73.1 },
  { id: 'chakan', name: 'Chakan (Pune)', state: 'Maharashtra', regionId: 'WEST-1', lat: 18.76, lng: 73.86 },
  { id: 'nashik', name: 'Nashik', state: 'Maharashtra', regionId: 'WEST-1', lat: 20.0, lng: 73.79 },
  { id: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat', regionId: 'WEST-1', lat: 23.02, lng: 72.57 },
  { id: 'surat', name: 'Surat', state: 'Gujarat', regionId: 'WEST-1', lat: 21.17, lng: 72.83 },
  { id: 'rajkot', name: 'Rajkot', state: 'Gujarat', regionId: 'WEST-1', lat: 22.3, lng: 70.8 },
  // WEST-2
  { id: 'indore', name: 'Indore', state: 'Madhya Pradesh', regionId: 'WEST-2', lat: 22.72, lng: 75.86 },
  { id: 'nagpur', name: 'Nagpur', state: 'Maharashtra', regionId: 'WEST-2', lat: 21.15, lng: 79.09 },
  { id: 'bhopal', name: 'Bhopal', state: 'Madhya Pradesh', regionId: 'WEST-2', lat: 23.26, lng: 77.41 },
  { id: 'sambhajinagar', name: 'Chhatrapati Sambhajinagar', state: 'Maharashtra', regionId: 'WEST-2', lat: 19.88, lng: 75.34 },
  { id: 'raipur', name: 'Raipur', state: 'Chhattisgarh', regionId: 'WEST-2', lat: 21.25, lng: 81.63 },
  // SOUTH-1
  { id: 'chennai', name: 'Chennai', state: 'Tamil Nadu', regionId: 'SOUTH-1', lat: 13.08, lng: 80.27 },
  { id: 'sricity', name: 'Sri City', state: 'Andhra Pradesh', regionId: 'SOUTH-1', lat: 13.55, lng: 80.02 },
  { id: 'krishnapatnam', name: 'Krishnapatnam', state: 'Andhra Pradesh', regionId: 'SOUTH-1', lat: 14.27, lng: 80.12 },
  { id: 'coimbatore', name: 'Coimbatore', state: 'Tamil Nadu', regionId: 'SOUTH-1', lat: 11.02, lng: 76.96 },
  { id: 'madurai', name: 'Madurai', state: 'Tamil Nadu', regionId: 'SOUTH-1', lat: 9.93, lng: 78.12 },
  { id: 'hosur', name: 'Hosur', state: 'Tamil Nadu', regionId: 'SOUTH-1', lat: 12.74, lng: 77.83 },
  { id: 'vijayawada', name: 'Vijayawada', state: 'Andhra Pradesh', regionId: 'SOUTH-1', lat: 16.51, lng: 80.65 },
  { id: 'visakhapatnam', name: 'Visakhapatnam', state: 'Andhra Pradesh', regionId: 'SOUTH-1', lat: 17.69, lng: 83.22 },
  // SOUTH-2
  { id: 'bengaluru', name: 'Bengaluru', state: 'Karnataka', regionId: 'SOUTH-2', lat: 12.97, lng: 77.59 },
  { id: 'hyderabad', name: 'Hyderabad', state: 'Telangana', regionId: 'SOUTH-2', lat: 17.39, lng: 78.49 },
  { id: 'kochi', name: 'Kochi', state: 'Kerala', regionId: 'SOUTH-2', lat: 9.93, lng: 76.27 },
  { id: 'mysuru', name: 'Mysuru', state: 'Karnataka', regionId: 'SOUTH-2', lat: 12.3, lng: 76.64 },
  { id: 'mangaluru', name: 'Mangaluru', state: 'Karnataka', regionId: 'SOUTH-2', lat: 12.91, lng: 74.86 },
  { id: 'hubballi', name: 'Hubballi', state: 'Karnataka', regionId: 'SOUTH-2', lat: 15.36, lng: 75.12 },
  { id: 'thrissur', name: 'Thrissur', state: 'Kerala', regionId: 'SOUTH-2', lat: 10.53, lng: 76.21 },
]

export const CITY_BY_ID: Record<string, City> = Object.fromEntries(CITIES.map((c) => [c.id, c]))

// ---------------------------------------------------------------------------
// Network snapshot
// ---------------------------------------------------------------------------

/**
 * Region-level opening snapshot. Facility rows are allocated from these
 * totals, so `sum(facility) === region` and `sum(region) === network` hold
 * exactly - the control tower never shows a total that fails to reconcile.
 *
 * targetPct is the regional budget. The network budget (85%) is set
 * top-down by the leadership team and is deliberately NOT the capacity-
 * weighted average of these (85.29%); Settings explains the difference.
 */
export const REGION_SNAPSHOT: Record<RegionId, { capacity: number; utilized: number; targetPct: number }> = {
  NORTH: { capacity: 30000, utilized: 24000, targetPct: 85 },
  EAST: { capacity: 24000, utilized: 18477, targetPct: 82 },
  'WEST-1': { capacity: 38000, utilized: 33440, targetPct: 87 },
  'WEST-2': { capacity: 15400, utilized: 15708, targetPct: 90 },
  'SOUTH-1': { capacity: 29600, utilized: 22496, targetPct: 83 },
  'SOUTH-2': { capacity: 25281, utilized: 20983, targetPct: 86 },
}

// ---------------------------------------------------------------------------
// Facility specifications
// ---------------------------------------------------------------------------

interface FacilitySpec {
  code: string
  name: string
  cityId: string
  type: FacilityType
  ownership: OwnershipModel
  execution: ExecutionId
  owner: string
  commissionedOn: string
  /** Relative share of the region's capacity. */
  weight: number
  /** Relative fill vs. the regional average. 1 = exactly the regional rate. */
  bias: number
  /** Fixes this facility's utilization; the remainder is shared by the rest. */
  pinnedPct?: number
  /**
   * Facility present in the movement feed but absent from the capacity
   * master. Held out of every utilization denominator and reported on the
   * Data Quality screen. `orphanUtilized` is its occupied pallet count.
   */
  capacityMissing?: boolean
  orphanUtilized?: number
}

const FACILITY_SPECS: Record<RegionId, FacilitySpec[]> = {
  NORTH: [
    { code: 'SNL-KUN-01', name: 'Kundli Cold Campus', cityId: 'kundli', type: 'DISTRIBUTION_CENTRE', ownership: 'OWNED', execution: 'SNOWMAN_OWN', owner: 'Harpreet Sandhu', commissionedOn: '2014-06-01', weight: 22, bias: 1.04 },
    { code: 'SNL-KUN-02', name: 'Kundli FCD', cityId: 'kundli', type: 'FORWARD_COLD_DEPOT', ownership: 'LEASED', execution: 'PARTNER_OPERATED', owner: 'Harpreet Sandhu', commissionedOn: '2019-11-15', weight: 7, bias: 0.93 },
    { code: 'SNL-PWL-01', name: 'Palwal DC', cityId: 'palwal', type: 'DISTRIBUTION_CENTRE', ownership: 'OWNED', execution: 'SNOWMAN_OWN', owner: 'Nikhil Chaudhary', commissionedOn: '2016-03-20', weight: 16, bias: 1.01 },
    { code: 'SNL-GZB-01', name: 'Ghaziabad DC', cityId: 'ghaziabad', type: 'DISTRIBUTION_CENTRE', ownership: 'LEASED', execution: 'SNOWMAN_OWN', owner: 'Nikhil Chaudhary', commissionedOn: '2018-08-02', weight: 13, bias: 0.97 },
    { code: 'SNL-LKO-01', name: 'Lucknow DC', cityId: 'lucknow', type: 'DISTRIBUTION_CENTRE', ownership: 'LEASED', execution: 'SNOWMAN_OWN', owner: 'Anjali Verma', commissionedOn: '2020-02-10', weight: 12, bias: 1, pinnedPct: 86.4 },
    { code: 'SNL-JAI-01', name: 'Jaipur DC', cityId: 'jaipur', type: 'DISTRIBUTION_CENTRE', ownership: 'LEASED', execution: 'SNOWMAN_OWN', owner: 'Devendra Rathore', commissionedOn: '2017-05-25', weight: 11, bias: 0.9 },
    { code: 'SNL-LDH-01', name: 'Ludhiana FCD', cityId: 'ludhiana', type: 'FORWARD_COLD_DEPOT', ownership: 'LEASED', execution: 'PARTNER_OPERATED', owner: 'Harpreet Sandhu', commissionedOn: '2021-01-18', weight: 9, bias: 0.86 },
    { code: 'SNL-CHD-01', name: 'Chandigarh Cross Dock', cityId: 'chandigarh', type: 'CROSS_DOCK', ownership: 'LEASED', execution: 'PARTNER_OPERATED', owner: 'Harpreet Sandhu', commissionedOn: '2022-07-04', weight: 10, bias: 0.79 },
    { code: 'SNL-DDN-01', name: 'Dehradun FCD', cityId: 'dehradun', type: 'FORWARD_COLD_DEPOT', ownership: 'LEASED', execution: 'PARTNER_OPERATED', owner: 'Anjali Verma', commissionedOn: '2025-12-01', weight: 0, bias: 1, capacityMissing: true, orphanUtilized: 485 },
  ],
  EAST: [
    { code: 'SNL-CCU-01', name: 'Kolkata Cold Campus', cityId: 'kolkata', type: 'DISTRIBUTION_CENTRE', ownership: 'OWNED', execution: 'SNOWMAN_OWN', owner: 'Arindam Bose', commissionedOn: '2012-09-12', weight: 24, bias: 1.05 },
    { code: 'SNL-DNK-01', name: 'Dankuni DC', cityId: 'dankuni', type: 'DISTRIBUTION_CENTRE', ownership: 'OWNED', execution: 'SNOWMAN_OWN', owner: 'Arindam Bose', commissionedOn: '2015-04-08', weight: 20, bias: 1.02 },
    { code: 'SNL-DNK-02', name: 'Dankuni Dedicated Block', cityId: 'dankuni', type: 'DISTRIBUTION_CENTRE', ownership: 'DEDICATED', execution: 'CUSTOMER_DEDICATED', owner: 'Arindam Bose', commissionedOn: '2021-06-30', weight: 12, bias: 1.09 },
    { code: 'SNL-SLG-01', name: 'Siliguri FCD', cityId: 'siliguri', type: 'FORWARD_COLD_DEPOT', ownership: 'LEASED', execution: 'PARTNER_OPERATED', owner: 'Pradip Roy', commissionedOn: '2019-02-14', weight: 11, bias: 0.9 },
    { code: 'SNL-GAU-01', name: 'Guwahati FCD', cityId: 'guwahati', type: 'FORWARD_COLD_DEPOT', ownership: 'LEASED', execution: 'PARTNER_OPERATED', owner: 'Pradip Roy', commissionedOn: '2018-10-05', weight: 10, bias: 0.94 },
    { code: 'SNL-PAT-01', name: 'Patna DC', cityId: 'patna', type: 'DISTRIBUTION_CENTRE', ownership: 'LEASED', execution: 'SNOWMAN_OWN', owner: 'Sanjay Kumar', commissionedOn: '2020-11-21', weight: 12, bias: 0.83 },
    { code: 'SNL-BBI-01', name: 'Bhubaneswar DC', cityId: 'bhubaneswar', type: 'DISTRIBUTION_CENTRE', ownership: 'LEASED', execution: 'SNOWMAN_OWN', owner: 'Sanjay Kumar', commissionedOn: '2019-07-19', weight: 11, bias: 0.88 },
    { code: 'SNL-RNC-01', name: 'Ranchi FCD', cityId: 'ranchi', type: 'FORWARD_COLD_DEPOT', ownership: 'LEASED', execution: 'PARTNER_OPERATED', owner: 'Sanjay Kumar', commissionedOn: '2026-08-01', weight: 0, bias: 1, capacityMissing: true, orphanUtilized: 742 },
  ],
  'WEST-1': [
    { code: 'SNL-BOM-01', name: 'Bhiwandi Cold Campus', cityId: 'bhiwandi', type: 'DISTRIBUTION_CENTRE', ownership: 'OWNED', execution: 'SNOWMAN_OWN', owner: 'Firoz Shaikh', commissionedOn: '2011-03-15', weight: 18, bias: 1.03 },
    { code: 'SNL-BOM-02', name: 'Bhiwandi DC-2', cityId: 'bhiwandi', type: 'DISTRIBUTION_CENTRE', ownership: 'LEASED', execution: 'SNOWMAN_OWN', owner: 'Firoz Shaikh', commissionedOn: '2017-09-01', weight: 13, bias: 1.05 },
    { code: 'SNL-PLG-01', name: 'Palghar DC', cityId: 'palghar', type: 'DISTRIBUTION_CENTRE', ownership: 'OWNED', execution: 'SNOWMAN_OWN', owner: 'Snehal Patil', commissionedOn: '2016-12-11', weight: 13, bias: 0.99 },
    { code: 'SNL-TLJ-01', name: 'Taloja DC', cityId: 'taloja', type: 'DISTRIBUTION_CENTRE', ownership: 'LEASED', execution: 'SNOWMAN_OWN', owner: 'Snehal Patil', commissionedOn: '2018-05-30', weight: 11, bias: 1.02 },
    { code: 'SNL-PNQ-01', name: 'Chakan DC', cityId: 'chakan', type: 'DISTRIBUTION_CENTRE', ownership: 'LEASED', execution: 'SNOWMAN_OWN', owner: 'Ganesh Kulkarni', commissionedOn: '2019-08-22', weight: 10, bias: 1, pinnedPct: 93.6 },
    { code: 'SNL-PNQ-02', name: 'Chakan Dedicated Block', cityId: 'chakan', type: 'DISTRIBUTION_CENTRE', ownership: 'DEDICATED', execution: 'CUSTOMER_DEDICATED', owner: 'Ganesh Kulkarni', commissionedOn: '2022-04-12', weight: 7, bias: 1.06 },
    { code: 'SNL-NSK-01', name: 'Nashik FCD', cityId: 'nashik', type: 'FORWARD_COLD_DEPOT', ownership: 'LEASED', execution: 'PARTNER_OPERATED', owner: 'Ganesh Kulkarni', commissionedOn: '2020-10-09', weight: 7, bias: 0.9 },
    { code: 'SNL-AMD-01', name: 'Ahmedabad DC', cityId: 'ahmedabad', type: 'DISTRIBUTION_CENTRE', ownership: 'OWNED', execution: 'SNOWMAN_OWN', owner: 'Kiran Joshi', commissionedOn: '2015-01-27', weight: 9, bias: 0.97 },
    { code: 'SNL-STV-01', name: 'Surat FCD', cityId: 'surat', type: 'FORWARD_COLD_DEPOT', ownership: 'LEASED', execution: 'PARTNER_OPERATED', owner: 'Kiran Joshi', commissionedOn: '2021-03-03', weight: 7, bias: 0.88 },
    { code: 'SNL-RAJ-01', name: 'Rajkot Cross Dock', cityId: 'rajkot', type: 'CROSS_DOCK', ownership: 'LEASED', execution: 'PARTNER_OPERATED', owner: 'Kiran Joshi', commissionedOn: '2023-02-16', weight: 5, bias: 0.82 },
  ],
  'WEST-2': [
    { code: 'SNL-IDR-01', name: 'Indore DC', cityId: 'indore', type: 'DISTRIBUTION_CENTRE', ownership: 'LEASED', execution: 'SNOWMAN_OWN', owner: 'Prashant Jain', commissionedOn: '2018-11-08', weight: 26, bias: 1, pinnedPct: 108.4 },
    { code: 'SNL-NAG-01', name: 'Nagpur DC', cityId: 'nagpur', type: 'DISTRIBUTION_CENTRE', ownership: 'OWNED', execution: 'SNOWMAN_OWN', owner: 'Rohit Bhandari', commissionedOn: '2016-07-14', weight: 24, bias: 1.02 },
    { code: 'SNL-BHO-01', name: 'Bhopal FCD', cityId: 'bhopal', type: 'FORWARD_COLD_DEPOT', ownership: 'LEASED', execution: 'PARTNER_OPERATED', owner: 'Prashant Jain', commissionedOn: '2020-05-19', weight: 15, bias: 1.03 },
    { code: 'SNL-IXU-01', name: 'Sambhajinagar DC', cityId: 'sambhajinagar', type: 'DISTRIBUTION_CENTRE', ownership: 'LEASED', execution: 'SNOWMAN_OWN', owner: 'Rohit Bhandari', commissionedOn: '2019-09-27', weight: 18, bias: 0.99 },
    { code: 'SNL-RPR-01', name: 'Raipur FCD', cityId: 'raipur', type: 'FORWARD_COLD_DEPOT', ownership: 'LEASED', execution: 'PARTNER_OPERATED', owner: 'Rohit Bhandari', commissionedOn: '2021-12-06', weight: 11, bias: 0.94 },
    { code: 'SNL-IDR-02', name: 'Indore Cross Dock', cityId: 'indore', type: 'CROSS_DOCK', ownership: 'LEASED', execution: 'PARTNER_OPERATED', owner: 'Prashant Jain', commissionedOn: '2023-06-20', weight: 6, bias: 0.96 },
  ],
  'SOUTH-1': [
    { code: 'SNL-MAA-01', name: 'Chennai Cold Campus', cityId: 'chennai', type: 'DISTRIBUTION_CENTRE', ownership: 'OWNED', execution: 'SNOWMAN_OWN', owner: 'Ramesh Subramanian', commissionedOn: '2013-02-05', weight: 20, bias: 1.06 },
    { code: 'SNL-SRC-01', name: 'Sri City DC', cityId: 'sricity', type: 'DISTRIBUTION_CENTRE', ownership: 'LEASED', execution: 'SNOWMAN_OWN', owner: 'Ramesh Subramanian', commissionedOn: '2018-01-30', weight: 16, bias: 1.02 },
    { code: 'SNL-KRP-01', name: 'Krishnapatnam Port DC', cityId: 'krishnapatnam', type: 'DISTRIBUTION_CENTRE', ownership: 'LEASED', execution: 'SNOWMAN_OWN', owner: 'Bhaskar Reddy', commissionedOn: '2024-04-18', weight: 14, bias: 1, pinnedPct: 38.2 },
    { code: 'SNL-CJB-01', name: 'Coimbatore DC', cityId: 'coimbatore', type: 'DISTRIBUTION_CENTRE', ownership: 'LEASED', execution: 'SNOWMAN_OWN', owner: 'Ramesh Subramanian', commissionedOn: '2017-11-11', weight: 13, bias: 0.99 },
    { code: 'SNL-IXM-01', name: 'Madurai FCD', cityId: 'madurai', type: 'FORWARD_COLD_DEPOT', ownership: 'LEASED', execution: 'PARTNER_OPERATED', owner: 'Ramesh Subramanian', commissionedOn: '2020-08-24', weight: 9, bias: 0.9 },
    { code: 'SNL-HSR-01', name: 'Hosur DC', cityId: 'hosur', type: 'DISTRIBUTION_CENTRE', ownership: 'DEDICATED', execution: 'CUSTOMER_DEDICATED', owner: 'Bhaskar Reddy', commissionedOn: '2021-09-13', weight: 11, bias: 1.04 },
    { code: 'SNL-VGA-01', name: 'Vijayawada FCD', cityId: 'vijayawada', type: 'FORWARD_COLD_DEPOT', ownership: 'LEASED', execution: 'PARTNER_OPERATED', owner: 'Bhaskar Reddy', commissionedOn: '2019-05-07', weight: 9, bias: 0.94 },
    { code: 'SNL-VTZ-01', name: 'Visakhapatnam DC', cityId: 'visakhapatnam', type: 'DISTRIBUTION_CENTRE', ownership: 'LEASED', execution: 'SNOWMAN_OWN', owner: 'Bhaskar Reddy', commissionedOn: '2018-03-29', weight: 8, bias: 0.97 },
  ],
  'SOUTH-2': [
    { code: 'SNL-BLR-01', name: 'Bengaluru Cold Campus', cityId: 'bengaluru', type: 'DISTRIBUTION_CENTRE', ownership: 'OWNED', execution: 'SNOWMAN_OWN', owner: 'Deepa Shetty', commissionedOn: '2012-12-03', weight: 22, bias: 1.05 },
    { code: 'SNL-BLR-02', name: 'Bengaluru FCD', cityId: 'bengaluru', type: 'FORWARD_COLD_DEPOT', ownership: 'LEASED', execution: 'PARTNER_OPERATED', owner: 'Deepa Shetty', commissionedOn: '2019-10-16', weight: 10, bias: 0.95 },
    { code: 'SNL-HYD-01', name: 'Hyderabad DC', cityId: 'hyderabad', type: 'DISTRIBUTION_CENTRE', ownership: 'OWNED', execution: 'SNOWMAN_OWN', owner: 'Srinivas Rao', commissionedOn: '2014-08-21', weight: 21, bias: 1.03 },
    { code: 'SNL-HYD-02', name: 'Hyderabad Dedicated Block', cityId: 'hyderabad', type: 'DISTRIBUTION_CENTRE', ownership: 'DEDICATED', execution: 'CUSTOMER_DEDICATED', owner: 'Srinivas Rao', commissionedOn: '2022-02-09', weight: 12, bias: 1.01 },
    { code: 'SNL-COK-01', name: 'Kochi DC', cityId: 'kochi', type: 'DISTRIBUTION_CENTRE', ownership: 'LEASED', execution: 'SNOWMAN_OWN', owner: 'Mathew Varghese', commissionedOn: '2017-06-06', weight: 14, bias: 0.96 },
    { code: 'SNL-MYQ-01', name: 'Mysuru FCD', cityId: 'mysuru', type: 'FORWARD_COLD_DEPOT', ownership: 'LEASED', execution: 'PARTNER_OPERATED', owner: 'Deepa Shetty', commissionedOn: '2021-04-27', weight: 8, bias: 0.88 },
    { code: 'SNL-IXE-01', name: 'Mangaluru FCD', cityId: 'mangaluru', type: 'FORWARD_COLD_DEPOT', ownership: 'LEASED', execution: 'PARTNER_OPERATED', owner: 'Mathew Varghese', commissionedOn: '2020-01-15', weight: 7, bias: 0.85 },
    { code: 'SNL-HBX-01', name: 'Hubballi FCD', cityId: 'hubballi', type: 'FORWARD_COLD_DEPOT', ownership: 'LEASED', execution: 'PARTNER_OPERATED', owner: 'Deepa Shetty', commissionedOn: '2026-07-15', weight: 0, bias: 1, capacityMissing: true, orphanUtilized: 615 },
  ],
}

// ---------------------------------------------------------------------------
// Zone mix
// ---------------------------------------------------------------------------

const ZONE_MIX: Record<FacilityType, Record<TemperatureZoneId, number>> = {
  DISTRIBUTION_CENTRE: { FROZEN: 0.62, CHILLED: 0.22, CONTROLLED_AMBIENT: 0.1, AMBIENT: 0.06 },
  FORWARD_COLD_DEPOT: { FROZEN: 0.7, CHILLED: 0.24, CONTROLLED_AMBIENT: 0.06, AMBIENT: 0 },
  CROSS_DOCK: { FROZEN: 0.55, CHILLED: 0.3, CONTROLLED_AMBIENT: 0.15, AMBIENT: 0 },
  PARK_AND_PAY: { FROZEN: 0, CHILLED: 0, CONTROLLED_AMBIENT: 0, AMBIENT: 1 },
}

/** Facilities whose frozen chamber is running a live temperature excursion. */
export const EXCURSION_ZONE_COMPLIANCE: Record<string, Partial<Record<TemperatureZoneId, number>>> = {
  'SNL-IDR-01': { FROZEN: 97.42 },
  'SNL-HYD-01': { CHILLED: 98.71 },
  'SNL-GAU-01': { FROZEN: 98.93 },
}

// ---------------------------------------------------------------------------
// Build facilities
// ---------------------------------------------------------------------------

function buildZones(spec: FacilitySpec, capacity: number | null, utilized: number) {
  const rng = rngFor(`zones:${spec.code}`)
  const mix = ZONE_MIX[spec.type]
  const active = TEMPERATURE_ZONES.filter((z) => mix[z.id] > 0)
  // Jitter the published mix a little so no two facilities look cloned.
  const weights = active.map((z) => mix[z.id] * (0.9 + rng() * 0.2))
  const capacities = capacity === null ? active.map(() => null) : allocateInteger(capacity, weights)
  // Frozen fills first in a cold-chain network; ambient runs slackest.
  const fillBias: Record<TemperatureZoneId, number> = {
    FROZEN: 1.05,
    CHILLED: 0.98,
    CONTROLLED_AMBIENT: 0.9,
    AMBIENT: 0.82,
  }
  const utilWeights = active.map((z, i) => {
    const base = capacity === null ? mix[z.id] : (capacities[i] as number)
    return Math.max(base * fillBias[z.id] * (0.94 + rng() * 0.12), 0.0001)
  })
  const utilizations = allocateInteger(utilized, utilWeights)

  return active.map((z, i) => {
    const override = EXCURSION_ZONE_COMPLIANCE[spec.code]?.[z.id]
    const compliance = override ?? Number((99.28 + rng() * 0.68).toFixed(2))
    return {
      zoneId: z.id,
      capacity: capacity === null ? null : (capacities[i] as number),
      utilizedPallets: utilizations[i],
      setPoint: z.setPoint,
      temperatureCompliancePct: z.id === 'AMBIENT' ? null : compliance,
    }
  })
}

function buildRegionFacilities(regionId: RegionId): Facility[] {
  const specs = FACILITY_SPECS[regionId]
  const snapshot = REGION_SNAPSHOT[regionId]
  const scoped = specs.filter((s) => !s.capacityMissing)

  const capacities = allocateInteger(
    snapshot.capacity,
    scoped.map((s) => s.weight),
  )

  // Pinned facilities take their exact utilization first; the rest share what
  // is left, weighted by capacity x fill bias. This keeps the planted demo
  // exceptions exact while the region total still reconciles.
  const pinnedUtilized = scoped.map((s, i) =>
    s.pinnedPct === undefined ? null : Math.round((capacities[i] * s.pinnedPct) / 100),
  )
  const pinnedTotal = pinnedUtilized.reduce<number>((a, b) => a + (b ?? 0), 0)
  const openIndexes = scoped.map((_, i) => i).filter((i) => pinnedUtilized[i] === null)
  const remaining = snapshot.utilized - pinnedTotal
  const openWeights = openIndexes.map((i) => capacities[i] * scoped[i].bias)
  const openUtilized = allocateInteger(Math.max(remaining, 0), openWeights)

  const utilized = [...pinnedUtilized] as (number | null)[]
  openIndexes.forEach((facilityIndex, k) => {
    utilized[facilityIndex] = openUtilized[k]
  })

  const built: Facility[] = scoped.map((spec, i) => {
    const capacity = capacities[i]
    const used = utilized[i] as number
    return {
      id: spec.code,
      code: spec.code,
      name: spec.name,
      regionId,
      cityId: spec.cityId,
      type: spec.type,
      ownership: spec.ownership,
      execution: spec.execution,
      owner: spec.owner,
      commissionedOn: spec.commissionedOn,
      capacity,
      utilizedPallets: used,
      zones: buildZones(spec, capacity, used),
    }
  })

  const orphans: Facility[] = specs
    .filter((s) => s.capacityMissing)
    .map((spec) => ({
      id: spec.code,
      code: spec.code,
      name: spec.name,
      regionId,
      cityId: spec.cityId,
      type: spec.type,
      ownership: spec.ownership,
      execution: spec.execution,
      owner: spec.owner,
      commissionedOn: spec.commissionedOn,
      capacity: null,
      utilizedPallets: spec.orphanUtilized ?? 0,
      zones: buildZones(spec, null, spec.orphanUtilized ?? 0),
    }))

  return [...built, ...orphans]
}

export const FACILITIES: Facility[] = REGION_ORDER.flatMap(buildRegionFacilities)

export const FACILITY_BY_ID: Record<string, Facility> = Object.fromEntries(FACILITIES.map((f) => [f.id, f]))

export const FACILITIES_BY_REGION: Record<RegionId, Facility[]> = REGION_ORDER.reduce(
  (acc, regionId) => {
    acc[regionId] = FACILITIES.filter((f) => f.regionId === regionId)
    return acc
  },
  {} as Record<RegionId, Facility[]>,
)

// ---------------------------------------------------------------------------
// Storage locations (chamber / bay level)
// ---------------------------------------------------------------------------

const CHAMBER_SUFFIX = ['A', 'B', 'C', 'D']

function buildLocations(): StorageLocation[] {
  const out: StorageLocation[] = []
  for (const facility of FACILITIES) {
    for (const zone of facility.zones) {
      if (zone.capacity !== null && zone.capacity === 0) continue
      const rng = rngFor(`loc:${facility.code}:${zone.zoneId}`)
      // Bigger chambers get split into more addressable blocks.
      const blocks = zone.capacity === null ? 2 : Math.max(2, Math.min(5, Math.round(zone.capacity / 900) + 1))
      const weights = Array.from({ length: blocks }, () => 0.7 + rng() * 0.6)
      const caps = zone.capacity === null ? weights.map(() => null) : allocateInteger(zone.capacity, weights)
      const utilWeights = weights.map((w, i) => {
        const base = zone.capacity === null ? w : Math.max((caps[i] as number), 1)
        return base * (0.88 + rng() * 0.24)
      })
      const utils = allocateInteger(zone.utilizedPallets, utilWeights)
      for (let i = 0; i < blocks; i += 1) {
        const chamber = `CH-${String(i + 1).padStart(2, '0')}`
        out.push({
          id: `${facility.code}:${zone.zoneId}:${chamber}`,
          facilityId: facility.id,
          regionId: facility.regionId,
          zoneId: zone.zoneId,
          chamber,
          label: `${chamber}-${CHAMBER_SUFFIX[i % CHAMBER_SUFFIX.length]}${String(i + 1).padStart(2, '0')}`,
          capacity: zone.capacity === null ? null : (caps[i] as number),
          utilizedPallets: utils[i],
        })
      }
    }
  }
  return out
}

export const LOCATIONS: StorageLocation[] = buildLocations()

/**
 * A deliberate data-quality defect: the source extract emits this chamber
 * twice. It is surfaced on the Data Quality screen and excluded from every
 * rollup, rather than being quietly de-duplicated.
 */
export const DUPLICATE_LOCATIONS: StorageLocation[] = (() => {
  const source = LOCATIONS.find((l) => l.id === 'SNL-BLR-01:FROZEN:CH-02')
  if (!source) return []
  return [{ ...source, id: `${source.id}#dup`, duplicateOf: source.id }]
})()

// ---------------------------------------------------------------------------
// Depositors
// ---------------------------------------------------------------------------

interface CustomerSpec {
  id: string
  name: string
  sector: string
  share: number
  change7d: number
  regionIds: RegionId[]
  facilityCount: number
  revenueMissing?: boolean
  revenuePerPallet?: number
}

const CUSTOMER_SPECS: CustomerSpec[] = [
  { id: 'himgiri', name: 'Himgiri Frozen Foods', sector: 'Frozen QSR supply', share: 11.4, change7d: 620, regionIds: ['NORTH', 'WEST-1', 'WEST-2', 'SOUTH-2'], facilityCount: 14, revenuePerPallet: 0.0128 },
  { id: 'sagarmatha', name: 'Sagarmatha Seafoods', sector: 'Marine exports', share: 8.9, change7d: -410, regionIds: ['SOUTH-1', 'SOUTH-2', 'WEST-1'], facilityCount: 9, revenuePerPallet: 0.0141 },
  { id: 'anandi-dairy', name: 'Anandi Dairy Co-operative', sector: 'Dairy', share: 8.2, change7d: 185, regionIds: ['WEST-1', 'WEST-2', 'NORTH'], facilityCount: 11, revenuePerPallet: 0.0119 },
  { id: 'quickserve', name: 'QuickServe Restaurants India', sector: 'QSR chain', share: 7.6, change7d: 744, regionIds: ['NORTH', 'SOUTH-2', 'WEST-1', 'EAST'], facilityCount: 16, revenuePerPallet: 0.0152 },
  { id: 'meghdoot', name: 'Meghdoot Ice Cream', sector: 'Ice cream', share: 6.8, change7d: -930, regionIds: ['WEST-1', 'NORTH', 'EAST'], facilityCount: 12, revenuePerPallet: 0.0134 },
  { id: 'nirvana-pharma', name: 'Nirvana Pharma Logistics', sector: 'Pharma cold chain', share: 5.4, change7d: 96, regionIds: ['NORTH', 'SOUTH-2', 'WEST-1'], facilityCount: 8, revenuePerPallet: 0.0246 },
  { id: 'coastal-proteins', name: 'Coastal Proteins Ltd', sector: 'Poultry & meat', share: 4.9, change7d: 312, regionIds: ['SOUTH-1', 'EAST'], facilityCount: 7, revenuePerPallet: 0.0126 },
  { id: 'greenfield-agro', name: 'Greenfield Agro Exports', sector: 'Fruit & vegetable', share: 4.3, change7d: -188, regionIds: ['WEST-2', 'NORTH', 'SOUTH-1'], facilityCount: 9, revenuePerPallet: 0.0111 },
  { id: 'sundarban-foods', name: 'Sundarban Foods', sector: 'Frozen ready-to-eat', share: 3.8, change7d: 254, regionIds: ['EAST'], facilityCount: 5, revenuePerPallet: 0.0122 },
  { id: 'deccan-bakers', name: 'Deccan Bakers', sector: 'Bakery & frozen dough', share: 3.5, change7d: 141, regionIds: ['SOUTH-2', 'WEST-2'], facilityCount: 6, revenuePerPallet: 0.013 },
  { id: 'aravalli-beverages', name: 'Aravalli Beverages', sector: 'Beverages', share: 3.1, change7d: -74, regionIds: ['NORTH', 'WEST-2'], facilityCount: 5, revenuePerPallet: 0.0098 },
  { id: 'konkan-cold', name: 'Konkan Cold Traders', sector: 'Trading', share: 2.8, change7d: 402, regionIds: ['WEST-1', 'WEST-2'], facilityCount: 4, revenueMissing: true },
  { id: 'nilgiri-naturals', name: 'Nilgiri Naturals', sector: 'Fruit pulp', share: 2.4, change7d: -55, regionIds: ['SOUTH-1', 'SOUTH-2'], facilityCount: 4, revenuePerPallet: 0.0115 },
  { id: 'vindhya-frozen', name: 'Vindhya Frozen Foods', sector: 'Frozen vegetables', share: 2.2, change7d: 508, regionIds: ['WEST-2'], facilityCount: 3, revenuePerPallet: 0.0124 },
  { id: 'brahmaputra-agri', name: 'Brahmaputra Agri Stores', sector: 'Agri commodities', share: 2.0, change7d: 61, regionIds: ['EAST'], facilityCount: 3, revenuePerPallet: 0.0107 },
  { id: 'chola-creamery', name: 'Chola Creamery', sector: 'Ice cream', share: 1.9, change7d: -122, regionIds: ['SOUTH-1'], facilityCount: 3, revenuePerPallet: 0.0132 },
  { id: 'rann-exports', name: 'Rann Exports', sector: 'Marine exports', share: 1.7, change7d: 88, regionIds: ['WEST-1'], facilityCount: 2, revenuePerPallet: 0.0138 },
  { id: 'kaveri-poultry', name: 'Kaveri Poultry Farms', sector: 'Poultry', share: 1.5, change7d: 37, regionIds: ['SOUTH-2'], facilityCount: 3, revenuePerPallet: 0.0121 },
  { id: 'himalayan-pharma', name: 'Himalayan Biologics', sector: 'Vaccines', share: 1.3, change7d: 15, regionIds: ['NORTH'], facilityCount: 2, revenuePerPallet: 0.0288 },
  { id: 'malabar-spices', name: 'Malabar Spice House', sector: 'Spices & extracts', share: 1.1, change7d: -29, regionIds: ['SOUTH-2'], facilityCount: 2, revenuePerPallet: 0.0104 },
  { id: 'gomti-foods', name: 'Gomti Foods', sector: 'Frozen snacks', share: 1.0, change7d: 44, regionIds: ['NORTH', 'EAST'], facilityCount: 3, revenuePerPallet: 0.0118 },
  { id: 'satpura-cold', name: 'Satpura Cold Storage Co', sector: 'Trading', share: 0.9, change7d: -12, regionIds: ['WEST-2'], facilityCount: 2, revenueMissing: true },
  { id: 'godavari-dairy', name: 'Godavari Dairy', sector: 'Dairy', share: 0.8, change7d: 26, regionIds: ['SOUTH-1'], facilityCount: 2, revenuePerPallet: 0.0116 },
  { id: 'others', name: 'Other depositors (38)', sector: 'Mixed', share: 12.5, change7d: -203, regionIds: REGION_ORDER, facilityCount: 46, revenuePerPallet: 0.0113 },
]

export function buildCustomers(networkOccupied: number): Customer[] {
  const shares = CUSTOMER_SPECS.map((c) => c.share)
  const pallets = allocateInteger(networkOccupied, shares)
  return CUSTOMER_SPECS.map((spec, i) => ({
    id: spec.id,
    name: spec.name,
    sector: spec.sector,
    occupiedPallets: pallets[i],
    change7d: spec.change7d,
    regionIds: spec.regionIds,
    facilityCount: spec.facilityCount,
    monthlyRevenueInrLakh: spec.revenueMissing
      ? null
      : Number((pallets[i] * (spec.revenuePerPallet ?? 0.012)).toFixed(1)),
  }))
}
