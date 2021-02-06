module.exports =  {
    make: (rand = Math.random()) => {
        let perm = new Int8Array(257)
        for (let i = 0; i < 256; i++)
            perm[i] = i & 1 ? 1 : -1;
  
        for (let i = 0; i < 256; i++) {
            let j = (Math.random() * 4294967296) & 255;
            [ perm[i], perm[j] ] = [ perm[j], perm[i] ];
        }
        perm[256] = perm[0];
        const perlin = {
            perm,
            noise1d: x => {
                let x0 = x|0;
                let x1 = x - x0;
                let xi = x0 & 255;
                let fx = (3 - 2 * x1) * x1 * x1;
                let a = x1 * perlin.perm[xi];
                let b = (x1 - 1) * perlin.perm[xi + 1];
          
                return a + fx * (b - a);
            },
            noise: x => {
                let sum = 0;
          
                sum += (1 + perlin.noise1d(x)) * 0.25;
                sum += (1 + perlin.noise1d(x * 2)) * 0.125;
                sum += (1 + perlin.noise1d(x * 4)) * 0.0625;
                sum += (1 + perlin.noise1d(x * 8)) * 0.03125;
          
                return sum;
            }
        }
        return perlin
    }
}