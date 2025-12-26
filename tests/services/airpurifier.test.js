const { getAirQualityLevel } = require('../../src/services/airpurifier');

describe('airpurifier service', () => {
  describe('getAirQualityLevel', () => {
    describe('good level (0-12)', () => {
      it('PM2.5 = 0 returns good', () => {
        const result = getAirQualityLevel(0);
        expect(result).toEqual({ level: 'good', color: '#00ff88' });
      });

      it('PM2.5 = 12 returns good', () => {
        const result = getAirQualityLevel(12);
        expect(result).toEqual({ level: 'good', color: '#00ff88' });
      });

      it('PM2.5 = 6 returns good', () => {
        const result = getAirQualityLevel(6);
        expect(result).toEqual({ level: 'good', color: '#00ff88' });
      });
    });

    describe('moderate level (13-35)', () => {
      it('PM2.5 = 13 returns moderate', () => {
        const result = getAirQualityLevel(13);
        expect(result).toEqual({ level: 'moderate', color: '#ffcc00' });
      });

      it('PM2.5 = 35 returns moderate', () => {
        const result = getAirQualityLevel(35);
        expect(result).toEqual({ level: 'moderate', color: '#ffcc00' });
      });

      it('PM2.5 = 25 returns moderate', () => {
        const result = getAirQualityLevel(25);
        expect(result).toEqual({ level: 'moderate', color: '#ffcc00' });
      });
    });

    describe('unhealthy-sensitive level (36-55)', () => {
      it('PM2.5 = 36 returns unhealthy-sensitive', () => {
        const result = getAirQualityLevel(36);
        expect(result).toEqual({ level: 'unhealthy-sensitive', color: '#ff9900' });
      });

      it('PM2.5 = 55 returns unhealthy-sensitive', () => {
        const result = getAirQualityLevel(55);
        expect(result).toEqual({ level: 'unhealthy-sensitive', color: '#ff9900' });
      });

      it('PM2.5 = 45 returns unhealthy-sensitive', () => {
        const result = getAirQualityLevel(45);
        expect(result).toEqual({ level: 'unhealthy-sensitive', color: '#ff9900' });
      });
    });

    describe('unhealthy level (56-150)', () => {
      it('PM2.5 = 56 returns unhealthy', () => {
        const result = getAirQualityLevel(56);
        expect(result).toEqual({ level: 'unhealthy', color: '#ff3333' });
      });

      it('PM2.5 = 150 returns unhealthy', () => {
        const result = getAirQualityLevel(150);
        expect(result).toEqual({ level: 'unhealthy', color: '#ff3333' });
      });

      it('PM2.5 = 100 returns unhealthy', () => {
        const result = getAirQualityLevel(100);
        expect(result).toEqual({ level: 'unhealthy', color: '#ff3333' });
      });
    });

    describe('very-unhealthy level (151-250)', () => {
      it('PM2.5 = 151 returns very-unhealthy', () => {
        const result = getAirQualityLevel(151);
        expect(result).toEqual({ level: 'very-unhealthy', color: '#cc00cc' });
      });

      it('PM2.5 = 250 returns very-unhealthy', () => {
        const result = getAirQualityLevel(250);
        expect(result).toEqual({ level: 'very-unhealthy', color: '#cc00cc' });
      });

      it('PM2.5 = 200 returns very-unhealthy', () => {
        const result = getAirQualityLevel(200);
        expect(result).toEqual({ level: 'very-unhealthy', color: '#cc00cc' });
      });
    });

    describe('hazardous level (251+)', () => {
      it('PM2.5 = 251 returns hazardous', () => {
        const result = getAirQualityLevel(251);
        expect(result).toEqual({ level: 'hazardous', color: '#990000' });
      });

      it('PM2.5 = 500 returns hazardous', () => {
        const result = getAirQualityLevel(500);
        expect(result).toEqual({ level: 'hazardous', color: '#990000' });
      });

      it('PM2.5 = 999 returns hazardous', () => {
        const result = getAirQualityLevel(999);
        expect(result).toEqual({ level: 'hazardous', color: '#990000' });
      });
    });
  });
});
