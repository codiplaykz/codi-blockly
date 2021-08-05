/**
 * @license
 * Copyright 2018 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Classes for a block move event.
 * @author fenichel@google.com (Rachel Fenichel)
 */
'use strict';

goog.module('Blockly.Events.BlockMove');
goog.module.declareLegacyNamespace();

/* eslint-disable-next-line no-unused-vars */
const Block = goog.requireType('Blockly.Block');
const BlockBase = goog.require('Blockly.Events.BlockBase');
const Coordinate = goog.require('Blockly.utils.Coordinate');
const Events = goog.require('Blockly.Events');
const connectionTypes = goog.require('Blockly.connectionTypes');
const object = goog.require('Blockly.utils.object');
const registry = goog.require('Blockly.registry');


/**
 * Class for a block move event.  Created before the move.
 * @param {!Block=} opt_block The moved block.  Undefined for a blank
 *     event.
 * @extends {BlockBase}
 * @constructor
 */
const BlockMove = function(opt_block) {
  BlockMove.superClass_.constructor.call(this, opt_block);
  if (!opt_block) {
    return;  // Blank event to be populated by fromJson.
  }
  if (opt_block.isShadow()) {
    // Moving shadow blocks is handled via disconnection.
    this.recordUndo = false;
  }

  const location = this.currentLocation_();
  this.oldParentId = location.parentId;
  this.oldInputName = location.inputName;
  this.oldCoordinate = location.coordinate;
};
object.inherits(BlockMove, BlockBase);

/**
 * Type of this event.
 * @type {string}
 */
BlockMove.prototype.type = Events.BLOCK_MOVE;

/**
 * Encode the event as JSON.
 * @return {!Object} JSON representation.
 */
BlockMove.prototype.toJson = function() {
  const json = BlockMove.superClass_.toJson.call(this);
  if (this.newParentId) {
    json['newParentId'] = this.newParentId;
  }
  if (this.newInputName) {
    json['newInputName'] = this.newInputName;
  }
  if (this.newCoordinate) {
    json['newCoordinate'] = Math.round(this.newCoordinate.x) + ',' +
        Math.round(this.newCoordinate.y);
  }
  if (!this.recordUndo) {
    json['recordUndo'] = this.recordUndo;
  }
  return json;
};

/**
 * Decode the JSON event.
 * @param {!Object} json JSON representation.
 */
BlockMove.prototype.fromJson = function(json) {
  BlockMove.superClass_.fromJson.call(this, json);
  this.newParentId = json['newParentId'];
  this.newInputName = json['newInputName'];
  if (json['newCoordinate']) {
    const xy = json['newCoordinate'].split(',');
    this.newCoordinate =
        new Coordinate(Number(xy[0]), Number(xy[1]));
  }
  if (json['recordUndo'] !== undefined) {
    this.recordUndo = json['recordUndo'];
  }
};

/**
 * Record the block's new location.  Called after the move.
 */
BlockMove.prototype.recordNew = function() {
  const location = this.currentLocation_();
  this.newParentId = location.parentId;
  this.newInputName = location.inputName;
  this.newCoordinate = location.coordinate;
};

/**
 * Returns the parentId and input if the block is connected,
 *   or the XY location if disconnected.
 * @return {!Object} Collection of location info.
 * @private
 */
BlockMove.prototype.currentLocation_ = function() {
  const workspace = this.getEventWorkspace_();
  const block = workspace.getBlockById(this.blockId);
  const location = {};
  const parent = block.getParent();
  if (parent) {
    location.parentId = parent.id;
    const input = parent.getInputWithBlock(block);
    if (input) {
      location.inputName = input.name;
    }
  } else {
    location.coordinate = block.getRelativeToSurfaceXY();
  }
  return location;
};

/**
 * Does this event record any change of state?
 * @return {boolean} False if something changed.
 */
BlockMove.prototype.isNull = function() {
  return this.oldParentId == this.newParentId &&
      this.oldInputName == this.newInputName &&
      Coordinate.equals(this.oldCoordinate, this.newCoordinate);
};

/**
 * Run a move event.
 * @param {boolean} forward True if run forward, false if run backward (undo).
 */
BlockMove.prototype.run = function(forward) {
  const workspace = this.getEventWorkspace_();
  const block = workspace.getBlockById(this.blockId);
  if (!block) {
    console.warn("Can't move non-existent block: " + this.blockId);
    return;
  }
  const parentId = forward ? this.newParentId : this.oldParentId;
  const inputName = forward ? this.newInputName : this.oldInputName;
  const coordinate = forward ? this.newCoordinate : this.oldCoordinate;
  let parentBlock;
  if (parentId) {
    parentBlock = workspace.getBlockById(parentId);
    if (!parentBlock) {
      console.warn("Can't connect to non-existent block: " + parentId);
      return;
    }
  }
  if (block.getParent()) {
    block.unplug();
  }
  if (coordinate) {
    const xy = block.getRelativeToSurfaceXY();
    block.moveBy(coordinate.x - xy.x, coordinate.y - xy.y);
  } else {
    const blockConnection = block.outputConnection || block.previousConnection;
    let parentConnection;
    const connectionType = blockConnection.type;
    if (inputName) {
      const input = parentBlock.getInput(inputName);
      if (input) {
        parentConnection = input.connection;
      }
    } else if (connectionType == connectionTypes.PREVIOUS_STATEMENT) {
      parentConnection = parentBlock.nextConnection;
    }
    if (parentConnection) {
      blockConnection.connect(parentConnection);
    } else {
      console.warn("Can't connect to non-existent input: " + inputName);
    }
  }
};

registry.register(registry.Type.EVENT, Events.MOVE,
    BlockMove);

exports = BlockMove;
