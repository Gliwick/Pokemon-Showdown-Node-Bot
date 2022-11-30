/*
 * Random Decision
 */

import { Battle } from "../battle";
import { Decision } from "../decision";
import { Module } from "../modules";

export class Random implements Module {
  id = "random";

  decide(battle: Battle, decisions: Decision[][]): Decision[] {
    return decisions[Math.floor(Math.random() * decisions.length)];
  }
}
