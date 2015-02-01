var FSM = require('machina').Fsm;

fsm = new FSM({
  initialState: "hotSpot.selection",
  currentVessel: null,
  stenosisBeginning: null,

  states: {
    "hotSpot.selection": {
      _onEnter: function () {
        this.emit('state.hotSpot.selection');
      },

      "select.hotSpot": function (payload) {
        this.currentVessel = payload.vessel;
        this.transition('select.stenosis.beginning');
        this.emit('hotSpot.selected');
      },

      "mouse.enter": function (payload) {
        this.emit('new.selection', payload.vessel, payload.node);
      },

      "mouse.leave": function (payload) {
        this.emit('clear.selection', payload.node);
      }
    },

    "select.stenosis.beginning": {
      _onEnter: function () {
        this.emit('state.stenosis.beginning');
      },

      _onExit: function () {
        this.emit('state.stenosis.beginning.exit');
      },

      "select.stenosis.beginning": function (point) {
        var pointLocation = this.currentVessel.findOppositePoint(point);

        this.stenosisBeginning = {
          vessel: this.currentVessel,
          location: pointLocation
        };

        this.transition('select.stenosis.additional');
      },

      "mouse.enter": function (point) {
        var location = this.currentVessel.findOppositePoint(point);

        this.emit('boing', location.alpha, location.beta);
      },

      "mouse.leave": function () {

      },

      "button.cancel": buttonCancel
    },

    "select.stenosis.additional": {
      _onEnter: function () {
        this.emit('state.stenosis.additional');
      },

      _onExit: function () {
        this.emit('state.stenosis.additional.exit');
      },

      'mouse.enter': function (payload) {
        this.emit('additional.stenosis.hover', {
          beginningVessel: this.currentVessel,
          endingVessel: payload.vessel,
          stenosisBeginning: this.stenosisBeginning,
          voronoiPoints: payload.voronoiPoints
        });
      },

      "button.cancel": buttonCancel
    }
  }
});

function buttonCancel () {
  this.transition('hotSpot.selection');
}

module.exports = fsm;
