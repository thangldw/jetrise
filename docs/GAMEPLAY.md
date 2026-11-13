# Gameplay

JETRISE is a single-player, browser-local airline simulation. This document describes the rules as implemented. Every price, demand figure and operating cost is a synthetic game value.

## Core loop

Found an airline → acquire and configure aircraft → open routes → plan flights and maintenance → compare decisions → run one day → read the actual results → reinvest.

Time advances only when you run a day. There is no real-time clock, no offline earnings and no penalty for being away.

## Founding

- Choose a home airport, airline name, logo and colour. The registration prefix is derived from the name.
- The airline receives $500 million and two different medium-range aircraft, once.
- Before the first flight you can configure cabins, amenities and livery, and open starting routes. The game suggests up to two domestic routes and one international route; you can also define your own.

## Fleet

Thirteen aircraft types, each with its own speed, range, seat capacity, fuel burn and price:

| Family | Types |
| --- | --- |
| Airbus | A220-300, A320neo, A321neo, A330-900neo, A350-900, A350-1000, A380-800 |
| Boeing | 737-800, 737 MAX 8, 787-8, 787-9, 777-300ER |
| Embraer | E190 |

- **Acquisition.** New orders are delivered after two or four days. Used aircraft are available immediately and priced by age and wear. A standard lease runs 14 days with daily rent, a refundable deposit, early return and expiry.
- **Limits.** The fleet is capped at eight aircraft including pending deliveries. Registrations are unique and persistent.
- **Cabin.** Economy (Y), Business (J) and First (F) seat counts share the airframe's space with weights 1 / 1.8 / 4.2. The cabin plan shows the exact seats.
- **Amenities.** Sixteen packages across connectivity, entertainment, comfort and onboard service, each with an upfront cost and a per-passenger cost. A preview shows the seven-day effect before you buy.
- **Livery.** Eighteen paint schemes with a live preview.
- Aircraft can be sold or moved between hubs, but not while airborne.

## Hubs and routes

- Buy additional hubs and upgrade their hangars.
- Search airports by city, name, country or IATA code, or create a scenario airport.
- Opening a route is a purchase; it does not add flights. Routes must start at one of your hubs and be within the aircraft's range.
- Every route is flown as a round trip that returns to its departure hub.
- Demand per airport pair is finite, varies by cabin class and weekday, and is shared by all your flights on that pair in both directions. Adding capacity beyond demand produces empty seats.
- Changing fares on a route costs a fixed fee and can be done once per route per day. Fare simulations are free and never commit.
- The route finder suggests up to three new routes from your hub, range and cash. It is a bounded search, not a guaranteed optimum.

## Scheduling

- The timetable is a repeating 168-hour week with 15-minute departure times.
- You can edit one flight or the same departure on every weekday in one step.
- The game rejects collisions, out-of-range routes, flights from the wrong hub, flights during maintenance and flights past a lease's end.
- The automatic planner compares three allocation strategies and shows a proposal. Nothing changes until you apply it.
- One-off recovery changes for a specific date are stored separately and never alter the weekly template.

## Maintenance and reliability

- Aircraft accumulate wear and service hours. Named technical faults ground an aircraft until repaired.
- Each aircraft needs a recurring five-hour weekly check; the game suggests night and weekend gaps.
- Major maintenance takes 24 hours and emergency maintenance 48 hours, limited by hangar capacity.

## Finance

- One wallet. A day cannot be run if the airline cannot afford its known costs.
- Fuel and CO2 allowances are stocked at a weighted average cost and topped up automatically for actual flights.
- Recurring costs: hub fees, payroll, staffing, training, ground and onboard service.
- Loans run 14, 28 or 56 operating days at a fixed daily rate, with a full payment table and optional partial prepayment.
- Marketing and research spending have operational effects.
- The daily report separates profit from cash flow. Headquarters → Finance explains the change in profit between two days or two weeks, using only recorded results.

## Running a day

Before a day is run, a briefing shows the forecast, known cancellations, the cash required and the expected closing cash. Confirming it settles every flight of that day and produces the actual report. History is kept for the last 28 days.

## Optional strategy systems

These are switched on explicitly and are off in a new career. Each activation shows a before/after forecast first. Several of them change the accounting model, so the game stores a backup at activation and offers a whole-career rollback.

| System | What it adds |
| --- | --- |
| **Competition** | Two local AI rival airlines compete for the same finite demand on your first hub's routes. Passengers choose by fare, departure time, amenities and reliability. Difficulty (easy, normal, hard) is chosen once at activation and sets rival cash, reliability and how quickly rivals react. Includes a 42-day challenge with no cash reward. |
| **Contracts** | Up to three offers per seven-day cycle on routes you own, with standard or negotiated terms. Contract passengers take Economy seats first; a bonus is paid at 90% completion or a penalty at the deadline. |
| **Market events** | Announced tourism, fuel and low-season events lasting four days. Paying for research reveals the exact effect in advance. |
| **Disruption recovery** | For a forecast cancellation you can swap aircraft, delay, lease a short-term replacement or cancel with passenger compensation, and compare the outcomes first. |
| **Per-leg ledger** | Accounts for each flight leg separately, with ticket cash recognised at departure. Required by the systems below. |
| **Connections** | Sells one-stop journeys across your network, including overnight and across the week boundary, with one fare split between both legs. |
| **Advance sales** | Sells direct tickets up to six days ahead, capped at 40% of seats, at fares locked on the day of sale. Schedule changes after that require explicit refunds. |
| **Airport slot rights** | Three chosen airports get a finite number of movements per hour, shared with the rivals. Rights are bought per weekday and hour and carry upkeep. |
| **Rival network growth** | Rivals lease additional aircraft and open additional routes from their own cash, within fixed limits. |
| **Positioning and loyalty** | Three service positions with different costs and passenger appeal, branched research projects, and aggregate customer loyalty by segment. |

## Guidance and review tools

- **Campaign.** Six chapters, from the first flight to operating two hubs, with one-time cash rewards totalling $450,000.
- **Alert center.** One list of maintenance, slot, connection and lease-expiry issues that need attention. It is read-only.
- **Decision comparison.** Compares up to four alternatives (fare, frequency, lease or route) against the current plan over a simulated week, then applies the chosen one in a single step.
- **Weekly recap.** Aggregates actual results by game week and lets you set one optional goal. Goals carry no reward.
- **Decision log.** The last 40 decisions with a seven-day review.

## Saves

The career is stored in the browser. The Save Manager can export it to a file, preview and import a file, restore the previous save, and restart while keeping an archive of the old career. Nothing is uploaded anywhere. See [ARCHITECTURE.md](ARCHITECTURE.md#saves) for the format.

## What is not simulated

- Other human players, accounts, cloud saves or any online service.
- Real traffic, fares or airline economics; there is no external data feed.
- Automatic weather or airport closures. Disruption scenarios are started by the player.
- Slot auctions, additional rival hubs and rival connecting itineraries.

Balance has been checked for accounting consistency by automated long-run simulations, not tuned through human playtesting.
