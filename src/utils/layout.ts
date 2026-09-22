/**
 * 画板布局与网格排版核心算法 (Smart Pipeline & Disjoint-Block Layout)
 * 严格按照《潜行》画板与图 1 真实业务逻辑排版：
 * - 分列与换列规则：
 *   - 连通块 (Connected Components) 超过 5 个或已有左右分列时，自适应分大列（BLOCKS_PER_COLUMN = 5）；
 *   - 大列之间保留通透舒适的 280px 物理留白大走廊 (COLUMN_GAP = 280)；
 * - 连通块内部流水线阶段分列对齐：
 *   - 根输入列 (COL_ROOT_INPUT): 参考音频 (referenceAudio) 等根输入；
 *   - 预处理/中间输入列 (COL_INTERMEDIATE): 音频融合 (audioMerge)、专属前置输入、辅助输入卡片；
 *   - 主生成器列 (COL_SINGLE_GEN): 单次克隆/音色创造生成器 (voiceClone, voiceDesign)；
 *     - 同一连通块内的各单次生成器分支在横向严格对齐在同一生成器列，绝不阶梯状向右漂移！
 *   - 单次产物 3 列网格: 紧随对应生成器右侧，以 3 列网格规整排布 (340px 宽，60px 间距)；
 *   - 批量生成器列 (COL_BATCH_GEN): 接收上游产物的批量生成器 (batchVoiceClone, batchVoiceDesign, integratedStudio)；
 *   - 批量产物 3 列网格: 紧随批量生成器右侧，以 3 列网格规整排布 (440px 宽，60px 间距)；
 * - 纵向排版与隔离：
 *   - 同一连通块内的不同分支在 Y 轴完全错开，预留充足净留白；
 *   - 连通块之间保留 170px 充裕呼吸间隔。
 */

export interface NodePosition {
  x: number;
  y: number;
}

export interface GridItemPosition {
  index: number;
  col: number;
  row: number;
  x: number;
  y: number;
}

export interface LayoutNodeInput {
  id: string;
  type: string;
  width: number;
  height: number;
  originalX: number;
  originalY: number;
  seqIndex?: number;
}

export interface LayoutEdgeInput {
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

/**
 * 计算 3 列产物网格中每个子项的坐标
 */
export function calculateArtifactGrid(
  count: number,
  startX: number,
  startY: number,
  maxCols = 3,
  itemW = 340,
  itemH = 145,
  colGap = 60,
  rowGap = 60
): GridItemPosition[] {
  return Array.from({ length: count }, (_, idx) => {
    const col = idx % maxCols;
    const row = Math.floor(idx / maxCols);
    return {
      index: idx,
      col,
      row,
      x: startX + col * (itemW + colGap),
      y: startY + row * (itemH + rowGap)
    };
  });
}

/**
 * 计算分支换列规则：每 5 个分支或高度累计超过 MAX_COL_HEIGHT 时换列
 */
export function calculateBranchColumns(
  branchHeights: number[],
  maxBranchesPerCol = 5,
  maxColHeight = 2200,
  branchGap = 50
): number[] {
  let currentCol = 0;
  let currentBranchesInCol = 0;
  let currentHeightInCol = 0;
  const colAllocations: number[] = [];

  for (let i = 0; i < branchHeights.length; i++) {
    const h = branchHeights[i];
    const isFirstInCol = currentBranchesInCol === 0;

    if (!isFirstInCol) {
      if (currentBranchesInCol >= maxBranchesPerCol || (currentHeightInCol > 0 && currentHeightInCol + h > maxColHeight)) {
        currentCol++;
        currentBranchesInCol = 0;
        currentHeightInCol = 0;
      }
    }

    colAllocations.push(currentCol);
    currentBranchesInCol++;
    currentHeightInCol += h + branchGap;
  }

  return colAllocations;
}

/**
 * 智能分层 DAG 网格排版算法（还原潜行画板真实规整排版）
 */
export function computeSmartDagLayout(
  nodes: LayoutNodeInput[],
  edges: LayoutEdgeInput[],
  originBaseX = 80,
  originBaseY = 80
): Map<string, NodePosition> {
  const resultPositions = new Map<string, NodePosition>();
  if (nodes.length === 0) return resultPositions;

  const nodeMap = new Map<string, LayoutNodeInput>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const getNodeW = (n: LayoutNodeInput): number => {
    if (n.width && n.width > 50) return n.width;
    if (n.type === "batchVoiceDesign") return 760;
    if (n.type === "batchVoiceClone" || n.type === "integratedStudio" || n.type === "gameVocal") return 660;
    if (n.type === "batchArtifact") return 440;
    if (n.type === "voiceClone" || n.type === "voiceDesign") return 370;
    if (n.type === "referenceAudio" || n.type === "audioMerge") return 340;
    return 340;
  };

  const getNodeH = (n: LayoutNodeInput): number => {
    if (n.height && n.height > 50) return n.height;
    if (n.type === "artifact") return 145;
    if (n.type === "batchArtifact") return 440;
    if (n.type === "voiceClone" || n.type === "voiceDesign") return 380;
    if (n.type === "referenceAudio" || n.type === "audioMerge") return 220;
    return 220;
  };

  const isGeneratorType = (t: string) =>
    t === "voiceClone" ||
    t === "voiceDesign" ||
    t === "batchVoiceClone" ||
    t === "batchVoiceDesign" ||
    t === "integratedStudio" ||
    t === "gameVocal";

  // 1. 识别直属产物与生成器的从属映射
  const generatorArtifactMap = new Map<string, LayoutNodeInput[]>();
  const isDirectArtifactNode = new Set<string>();
  const artifactGeneratorMap = new Map<string, string>();

  edges.forEach((e) => {
    const target = nodeMap.get(e.target);
    const source = nodeMap.get(e.source);
    if (target && (target.type === "artifact" || target.type === "batchArtifact")) {
      const isGen = source && isGeneratorType(source.type);
      if (isGen || e.targetHandle === "artifact") {
        isDirectArtifactNode.add(target.id);
        artifactGeneratorMap.set(target.id, e.source);
        const list = generatorArtifactMap.get(e.source) || [];
        if (!list.some((item) => item.id === target.id)) {
          list.push(target);
        }
        generatorArtifactMap.set(e.source, list);
      }
    }
  });

  // 对直属产物排序 (seqIndex 优先，原 Y 次之)
  generatorArtifactMap.forEach((arts) => {
    arts.sort((a, b) => {
      const seqA = a.seqIndex ?? 999;
      const seqB = b.seqIndex ?? 999;
      if (seqA !== seqB) return seqA - seqB;
      return a.originalY - b.originalY;
    });
  });

  // 2. 识别连通块 (Connected Components)
  const adjMap = new Map<string, Set<string>>();
  nodes.forEach((n) => adjMap.set(n.id, new Set()));

  edges.forEach((e) => {
    if (adjMap.has(e.source) && adjMap.has(e.target)) {
      adjMap.get(e.source)!.add(e.target);
      adjMap.get(e.target)!.add(e.source);
    }
  });

  const visited = new Set<string>();
  const blocks: LayoutNodeInput[][] = [];

  nodes.forEach((n) => {
    if (visited.has(n.id)) return;
    const comp: LayoutNodeInput[] = [];
    const queue = [n.id];
    visited.add(n.id);

    while (queue.length > 0) {
      const currId = queue.shift()!;
      const currNode = nodeMap.get(currId);
      if (currNode) comp.push(currNode);

      const nbrs = adjMap.get(currId) || new Set();
      nbrs.forEach((nbrId) => {
        if (!visited.has(nbrId)) {
          visited.add(nbrId);
          queue.push(nbrId);
        }
      });
    }

    if (comp.length > 0) {
      blocks.push(comp);
    }
  });

  // 连通块排序：若已有左右分列 (X 间距 >= 3000px)，优先保持列归属，同列内按原 Y 排序；否则全局按原 Y 排序
  blocks.sort((a, b) => {
    const minXA = Math.min(...a.map((n) => n.originalX));
    const minXB = Math.min(...b.map((n) => n.originalX));
    const colA = minXA >= 3000 ? 1 : 0;
    const colB = minXB >= 3000 ? 1 : 0;
    if (colA !== colB) return colA - colB;
    const minYA = Math.min(...a.map((n) => n.originalY));
    const minYB = Math.min(...b.map((n) => n.originalY));
    return minYA - minYB;
  });

  // 3. 分列规则：每 5 个连通块自动换到下一大列 (BLOCKS_PER_COLUMN = 5)
  const BLOCKS_PER_COLUMN = 5;
  const blockColumns: LayoutNodeInput[][][] = [];
  for (let i = 0; i < blocks.length; i += BLOCKS_PER_COLUMN) {
    blockColumns.push(blocks.slice(i, i + BLOCKS_PER_COLUMN));
  }

  let globalColStartX = originBaseX;

  blockColumns.forEach((colBlocks) => {
    let currentBlockStartY = originBaseY;
    let actualColMaxRightX = globalColStartX;

    colBlocks.forEach((blockNodes) => {
      const blockNodeMap = new Map<string, LayoutNodeInput>();
      blockNodes.forEach((n) => blockNodeMap.set(n.id, n));

      const inEdgesMap = new Map<string, LayoutEdgeInput[]>();
      const outEdgesMap = new Map<string, LayoutEdgeInput[]>();
      blockNodes.forEach((n) => {
        inEdgesMap.set(n.id, []);
        outEdgesMap.set(n.id, []);
      });

      edges.forEach((e) => {
        if (blockNodeMap.has(e.source) && blockNodeMap.has(e.target)) {
          inEdgesMap.get(e.target)!.push(e);
          outEdgesMap.get(e.source)!.push(e);
        }
      });

      const logicNodes = blockNodes.filter((n) => !isDirectArtifactNode.has(n.id));

      if (logicNodes.length === 0) {
        let lastY = currentBlockStartY;
        blockNodes.forEach((n) => {
          resultPositions.set(n.id, { x: globalColStartX, y: lastY });
          lastY += getNodeH(n) + 40;
        });
        currentBlockStartY = lastY + 170;
        return;
      }

      const generators = logicNodes.filter((n) => isGeneratorType(n.type));

      // 检查节点是否接收来自其他生成器的产物（支持直连或通过中间输入节点转发）
      const getUpstreamArtifactFromOtherGen = (nodeId: string, currentGenId: string): LayoutNodeInput | null => {
        if (isDirectArtifactNode.has(nodeId)) {
          const up = artifactGeneratorMap.get(nodeId);
          if (up && up !== currentGenId) return blockNodeMap.get(nodeId) || null;
        }
        const ins = inEdgesMap.get(nodeId) || [];
        for (const e of ins) {
          if (isDirectArtifactNode.has(e.source)) {
            const upGen = artifactGeneratorMap.get(e.source);
            if (upGen && upGen !== currentGenId) {
              return blockNodeMap.get(e.source) || null;
            }
          }
        }
        return null;
      };

      // 区分主生成器与下游流水线生成器
      const downstreamGens = new Set<string>();
      generators.forEach((g) => {
        const inEdges = inEdgesMap.get(g.id) || [];
        const hasDirectGenUpstream = inEdges.some((e) => {
          const src = blockNodeMap.get(e.source);
          return src && isGeneratorType(src.type);
        });
        const hasArtifactUpstream = inEdges.some((e) => {
          const artNode = getUpstreamArtifactFromOtherGen(e.source, g.id);
          if (!artNode) return false;
          const upGen = artifactGeneratorMap.get(artNode.id);
          const isBatchGen = g.type === "batchVoiceClone" || g.type === "batchVoiceDesign" || g.type === "integratedStudio" || g.type === "gameVocal";
          return upGen && upGen !== g.id && (isBatchGen || generators.length <= 2);
        });
        if (hasDirectGenUpstream || hasArtifactUpstream) {
          downstreamGens.add(g.id);
        }
      });

      const primaryGens = generators.filter((g) => !downstreamGens.has(g.id));
      primaryGens.sort((a, b) => a.originalY - b.originalY);

      // 检查节点是否向主生成器输出了连线 (如参考音频、音频整合连接到生成器的 voice/input)
      const feedsIntoPrimaryGen = (nodeId: string): boolean => {
        const outs = outEdgesMap.get(nodeId) || [];
        return outs.some((e) => primaryGens.some((g) => g.id === e.target));
      };

      const isDownstreamInput = (n: LayoutNodeInput): boolean => {
        // 若节点直接为主生成器提供输入，其根本角色为前置输入源，必须排布在生成器左侧，绝不视作下游！
        if (feedsIntoPrimaryGen(n.id)) return false;
        return getUpstreamArtifactFromOtherGen(n.id, "") !== null;
      };

      if (generators.length === 0) {
        let lastY = currentBlockStartY;
        logicNodes.forEach((n) => {
          resultPositions.set(n.id, { x: globalColStartX, y: lastY });
          lastY += getNodeH(n) + 50;
        });
        currentBlockStartY = lastY + 170;
        return;
      }

      // 检查是否有前置纯音色发生器 (例如 Test 5 中的 design -> art1 -> clone)
      const isUpstreamOriginGen = primaryGens.length === 1 && downstreamGens.size > 0 &&
        (inEdgesMap.get(primaryGens[0].id) || []).length === 0 &&
        (generatorArtifactMap.get(primaryGens[0].id) || []).length > 0 &&
        (generatorArtifactMap.get(primaryGens[0].id) || []).length <= 2;

      // 逻辑输入节点分类 (排除下游分支专属的中间输入，如接收产物的 audioMerge)
      const rootInputs = logicNodes.filter((n) => {
        if (isGeneratorType(n.type) || isDirectArtifactNode.has(n.id)) return false;
        if (isDownstreamInput(n)) return false;
        const ins = inEdgesMap.get(n.id) || [];
        if (isUpstreamOriginGen) return false;
        const hasLogicInEdges = ins.some((e) => {
          const src = blockNodeMap.get(e.source);
          return src && !isDirectArtifactNode.has(src.id);
        });
        return ins.length === 0 || (!hasLogicInEdges && feedsIntoPrimaryGen(n.id));
      });

      const intermediateInputs = logicNodes.filter((n) => {
        if (isGeneratorType(n.type) || isDirectArtifactNode.has(n.id)) return false;
        if (isDownstreamInput(n)) return false;
        return !rootInputs.some((r) => r.id === n.id);
      });

      // 计算列横向坐标
      const rootColW = rootInputs.length > 0 ? Math.max(...rootInputs.map(getNodeW)) : 0;
      const intermediateColW = intermediateInputs.length > 0 ? Math.max(...intermediateInputs.map(getNodeW)) : 0;

      let rootColX = globalColStartX;
      let intermediateColX = globalColStartX;
      let genColX = globalColStartX;

      if (isUpstreamOriginGen) {
        genColX = globalColStartX;
      } else if (rootInputs.length > 0 && intermediateInputs.length > 0) {
        rootColX = globalColStartX;
        const gap0 = rootColW <= 300 ? 60 : 50;
        intermediateColX = rootColX + rootColW + gap0;
        const gap1 = intermediateColW <= 300 ? 60 : 50;
        genColX = intermediateColX + intermediateColW + gap1;
      } else if (rootInputs.length > 0) {
        rootColX = globalColStartX;
        genColX = rootColX + rootColW + 60;
      } else if (intermediateInputs.length > 0) {
        intermediateColX = globalColStartX;
        genColX = intermediateColX + intermediateColW + 60;
      } else {
        genColX = globalColStartX;
      }

      let currentBranchY = currentBlockStartY;
      let prevBranchDownstreamArtifactsBottomY = currentBlockStartY;
      let blockMaxY = currentBlockStartY;

      primaryGens.forEach((gen, gIdx) => {
        let branchStartY = currentBranchY;
        let branchMaxY = branchStartY;

        // 首个分支排布根输入
        if (gIdx === 0 && rootInputs.length > 0) {
          let rY = branchStartY;
          rootInputs.forEach((rn) => {
            resultPositions.set(rn.id, { x: rootColX, y: rY });
            rY += getNodeH(rn) + 50;
          });
          if (rY - 50 > branchMaxY) branchMaxY = rY - 50;
        }

        // 排布中间预处理输入
        if (gIdx === 0 && !isUpstreamOriginGen) {
          const g0Inputs = intermediateInputs.filter((n) => {
            const outs = outEdgesMap.get(n.id) || [];
            return outs.some((e) => e.target === gen.id) || outs.length === 0;
          });
          let mY = branchStartY;
          g0Inputs.forEach((mn) => {
            resultPositions.set(mn.id, { x: intermediateColX, y: mY });
            mY += getNodeH(mn) + 50;
          });
          if (mY - 50 > branchMaxY) branchMaxY = mY - 50;
        } else if (!isUpstreamOriginGen) {
          const gInputs = intermediateInputs.filter((n) => {
            const outs = outEdgesMap.get(n.id) || [];
            return outs.some((e) => e.target === gen.id);
          });
          if (gInputs.length > 0) {
            gInputs.sort((a, b) => a.originalY - b.originalY);
            gInputs.forEach((an, aIdx) => {
              const auxY = branchStartY - (gInputs.length - aIdx) * 235 - 50;
              resultPositions.set(an.id, { x: intermediateColX, y: Math.max(currentBlockStartY, auxY) });
            });
          }
        }

        // 生成器垂直平齐对齐其主输入 (如有)
        const genInEdges = inEdgesMap.get(gen.id) || [];
        const primaryInputEdge = genInEdges.find((e) => e.targetHandle === "voice") || genInEdges[0];
        if (primaryInputEdge && resultPositions.has(primaryInputEdge.source)) {
          const inPos = resultPositions.get(primaryInputEdge.source)!;
          if (gIdx === 0 && inPos.y >= branchStartY) {
            branchStartY = inPos.y;
          }
        }

        // 主生成器摆放
        resultPositions.set(gen.id, { x: genColX, y: branchStartY });

        // 生成器专属直属产物 (3 列规整网格)
        const arts = generatorArtifactMap.get(gen.id) || [];
        const isBatch =
          arts.some((a) => a.type === "batchArtifact") ||
          gen.type === "batchVoiceClone" ||
          gen.type === "batchVoiceDesign" ||
          gen.type === "integratedStudio" ||
          gen.type === "gameVocal";

        const itemW = isBatch ? 440 : 340;
        const itemH = isBatch ? 440 : 145;
        const colGap = 60;
        const rowGap = 60;
        const genW = getNodeW(gen);
        const artStartX = genColX + genW + 60;

        arts.forEach((art, aIdx) => {
          const c = aIdx % 3;
          const r = Math.floor(aIdx / 3);
          const ax = artStartX + c * (itemW + colGap);
          const ay = branchStartY + r * (itemH + rowGap);
          resultPositions.set(art.id, { x: ax, y: ay });
        });

        const artRows = Math.ceil(arts.length / 3);
        const artGridH = artRows > 0 ? (artRows - 1) * (itemH + rowGap) + itemH : 0;
        const genBottomY = branchStartY + Math.max(getNodeH(gen), artGridH);
        if (genBottomY > branchMaxY) branchMaxY = genBottomY;

        // 下游流水线生成器 (承接该分支产物向右延伸)
        const downstreamInBranch = Array.from(downstreamGens)
          .map((id) => blockNodeMap.get(id))
          .filter((dg): dg is LayoutNodeInput => {
            if (!dg) return false;
            const inE = inEdgesMap.get(dg.id) || [];
            return inE.some((e) => {
              if (e.source === gen.id || arts.some((a) => a.id === e.source)) return true;
              const artNode = getUpstreamArtifactFromOtherGen(e.source, dg.id);
              return artNode && arts.some((a) => a.id === artNode.id);
            });
          });

        if (downstreamInBranch.length > 0) {
          downstreamInBranch.forEach((dsGen) => {
            const dsInputs = (inEdgesMap.get(dsGen.id) || [])
              .map((e) => blockNodeMap.get(e.source))
              .filter((n): n is LayoutNodeInput => Boolean(n && isDownstreamInput(n)));

            const artGridRight = arts.length > 0
              ? (artStartX + (Math.min(arts.length, 3) - 1) * (itemW + colGap) + itemW)
              : (genColX + genW);

            let dsGenX = 0;
            let dsGenY = 0;

            if (isUpstreamOriginGen) {
              let inColY = branchStartY;
              if (arts.length > 0) {
                inColY = branchStartY + getNodeH(arts[0]) + 50;
              }
              intermediateInputs.forEach((inp) => {
                resultPositions.set(inp.id, { x: artStartX, y: inColY });
                inColY += getNodeH(inp) + 50;
              });
              const interW = Math.max(itemW, ...intermediateInputs.map(getNodeW));
              dsGenX = artStartX + interW + 80;
              dsGenY = (gIdx === 0 || prevBranchDownstreamArtifactsBottomY === currentBlockStartY) ? currentBlockStartY : branchStartY;
            } else if (dsInputs.length > 0) {
              // 综合规则：下游分支带有前置中间输入卡片（如 audioMerge 参考音频整合）
              // 1. 中间输入排布在上游产物网格之后 (artGridRight + 60)
              const interColX = artGridRight + 60;
              const interColW = Math.max(...dsInputs.map(getNodeW));
              // 2. 下游生成器紧随中间输入卡片之后
              dsGenX = interColX + interColW + 60;

              // 3. 纵向坐标平齐对齐来源产物 (优雅向右下游延伸，消灭折回逆流线)
              const srcArtNode = getUpstreamArtifactFromOtherGen(dsInputs[0].id, dsGen.id);
              let dsStartY = branchStartY;
              if (srcArtNode && resultPositions.has(srcArtNode.id)) {
                dsStartY = Math.max(branchStartY, resultPositions.get(srcArtNode.id)!.y);
              }
              if (prevBranchDownstreamArtifactsBottomY > dsStartY) {
                dsStartY = prevBranchDownstreamArtifactsBottomY + 50;
              }

              dsInputs.forEach((inp, iIdx) => {
                resultPositions.set(inp.id, { x: interColX, y: dsStartY + iIdx * (getNodeH(inp) + 50) });
              });
              dsGenY = dsStartY;
            } else {
              // 无中间输入卡片，下游生成器直接排布在产物网格之后 (如《潜行》画板)
              dsGenX = arts.length > 0
                ? (artStartX + 2 * (itemW + colGap) + itemW + 60)
                : (genColX + genW + 60);

              dsGenY = (gIdx === 0 || prevBranchDownstreamArtifactsBottomY === currentBlockStartY)
                ? currentBlockStartY
                : branchStartY;
              if (gIdx > 0 && prevBranchDownstreamArtifactsBottomY > currentBlockStartY && prevBranchDownstreamArtifactsBottomY > branchStartY) {
                dsGenY = prevBranchDownstreamArtifactsBottomY + 50;
              }

              // 对齐主输入 (仅当直连逻辑输入节点时对齐，产物则按分支阶段自然流转)
              const dsInEdges = inEdgesMap.get(dsGen.id) || [];
              const primaryDsEdge = dsInEdges.find((e) => e.targetHandle === "voice" && !isDirectArtifactNode.has(e.source));
              if (primaryDsEdge && resultPositions.has(primaryDsEdge.source)) {
                const pSrcPos = resultPositions.get(primaryDsEdge.source)!;
                if (pSrcPos.y >= currentBlockStartY) {
                  dsGenY = pSrcPos.y;
                }
              }
            }

            resultPositions.set(dsGen.id, { x: dsGenX, y: dsGenY });

            const dsArts = generatorArtifactMap.get(dsGen.id) || [];
            const dsIsBatch = dsArts.some((a) => a.type === "batchArtifact") ||
              dsGen.type === "batchVoiceClone" ||
              dsGen.type === "batchVoiceDesign" ||
              dsGen.type === "integratedStudio" ||
              dsGen.type === "gameVocal";

            const dsItemW = dsIsBatch ? 440 : 340;
            const dsItemH = dsIsBatch ? 440 : 145;
            const dsGenW = getNodeW(dsGen);
            const dsArtStartX = dsGenX + dsGenW + 60;

            dsArts.forEach((dart, daIdx) => {
              const c = daIdx % 3;
              const r = Math.floor(daIdx / 3);
              const dax = dsArtStartX + c * (dsItemW + colGap);
              const day = dsGenY + r * (dsItemH + rowGap);
              resultPositions.set(dart.id, { x: dax, y: day });
            });

            const dsArtRows = Math.ceil(dsArts.length / 3);
            const dsArtGridH = dsArtRows > 0 ? (dsArtRows - 1) * (dsItemH + rowGap) + dsItemH : 0;
            const dsBottomY = dsGenY + Math.max(getNodeH(dsGen), dsArtGridH);
            prevBranchDownstreamArtifactsBottomY = dsBottomY;
            if (dsBottomY > branchMaxY) branchMaxY = dsBottomY;
          });
        }

        // 识别连接到当前分支产物、但未被下游生成器消费的末端/聚合节点 (如纯终端导出、试听合并节点)
        const unconsumedDownstreamInputs = logicNodes.filter((n) => {
          if (isGeneratorType(n.type) || isDirectArtifactNode.has(n.id)) return false;
          if (resultPositions.has(n.id)) return false;
          // 若节点输出了连线给任何生成器，其必须在生成器前方排布，绝非未消费的终端节点！
          const outs = outEdgesMap.get(n.id) || [];
          if (outs.some((e) => isGeneratorType(blockNodeMap.get(e.target)?.type || ""))) return false;
          const ins = inEdgesMap.get(n.id) || [];
          return ins.some((e) => arts.some((a) => a.id === e.source));
        });

        if (unconsumedDownstreamInputs.length > 0) {
          const artGridRight = arts.length > 0
            ? (artStartX + (Math.min(arts.length, 3) - 1) * (itemW + colGap) + itemW)
            : (genColX + genW);

          const termColX = artGridRight + 60;
          let termY = branchStartY;
          unconsumedDownstreamInputs.forEach((inp) => {
            resultPositions.set(inp.id, { x: termColX, y: termY });
            termY += getNodeH(inp) + 50;
          });
          if (termY - 50 > branchMaxY) branchMaxY = termY - 50;
        }

        // 下一主生成器分支在纵向错开
        const branchGap = isBatch ? 160 : 80;
        currentBranchY = genBottomY + branchGap;
        if (branchMaxY > blockMaxY) blockMaxY = branchMaxY;
      });

      // 多个生成器分支共享的输入节点居中对齐
      logicNodes.forEach((n) => {
        if (isGeneratorType(n.type)) return;
        const outs = outEdgesMap.get(n.id) || [];
        const targetGens = outs
          .map((e) => blockNodeMap.get(e.target))
          .filter((tg): tg is LayoutNodeInput => Boolean(tg && isGeneratorType(tg.type)));
        if (targetGens.length >= 2) {
          const genPositions = targetGens.map((tg) => resultPositions.get(tg.id)).filter(Boolean);
          if (genPositions.length >= 2) {
            const minGenY = Math.min(...genPositions.map((p) => p!.y));
            const maxGenBottom = Math.max(...targetGens.map((tg) => (resultPositions.get(tg!.id)?.y || 0) + getNodeH(tg!)));
            const centerY = Math.round((minGenY + maxGenBottom) / 2 - getNodeH(n) / 2);
            resultPositions.set(n.id, { x: resultPositions.get(n.id)?.x || globalColStartX, y: Math.max(currentBlockStartY, centerY) });
          }
        }
      });

      // 保证连通块内每一个节点 100% 都有确定的布局位置，绝不遗漏任何节点
      const unplacedNodes = blockNodes.filter((n) => !resultPositions.has(n.id));
      if (unplacedNodes.length > 0) {
        let fallbackY = blockMaxY + 50;
        unplacedNodes.forEach((un) => {
          const inE = inEdgesMap.get(un.id) || [];
          const outE = outEdgesMap.get(un.id) || [];

          // 优先看是否有已摆放的上游节点，排在其右侧
          const placedSources = inE
            .map((e) => blockNodeMap.get(e.source))
            .filter((s): s is LayoutNodeInput => Boolean(s && resultPositions.has(s.id)));
          if (placedSources.length > 0) {
            const maxX = Math.max(...placedSources.map((s) => (resultPositions.get(s.id)?.x || 0) + getNodeW(s)));
            const avgY = Math.round(placedSources.reduce((sum, s) => sum + (resultPositions.get(s.id)?.y || 0), 0) / placedSources.length);
            resultPositions.set(un.id, { x: maxX + 60, y: avgY });
            return;
          }

          // 其次看是否有已摆放的下游节点，排在其左侧
          const placedTargets = outE
            .map((e) => blockNodeMap.get(e.target))
            .filter((t): t is LayoutNodeInput => Boolean(t && resultPositions.has(t.id)));
          if (placedTargets.length > 0) {
            const minX = Math.min(...placedTargets.map((t) => resultPositions.get(t.id)?.x || 0));
            const avgY = Math.round(placedTargets.reduce((sum, t) => sum + (resultPositions.get(t.id)?.y || 0), 0) / placedTargets.length);
            resultPositions.set(un.id, { x: Math.max(globalColStartX, minX - getNodeW(un) - 60), y: avgY });
            return;
          }

          // 否则作为独立节点排在当前块底部
          resultPositions.set(un.id, { x: globalColStartX, y: fallbackY });
          fallbackY += getNodeH(un) + 50;
          if (fallbackY > blockMaxY) blockMaxY = fallbackY;
        });
      }

      // 统计物理最右边缘
      blockNodes.forEach((n) => {
        const p = resultPositions.get(n.id);
        if (p) {
          const w = getNodeW(n);
          if (p.x + w > actualColMaxRightX) actualColMaxRightX = p.x + w;
        }
      });

      // 连通块之间垂直间隔 170px
      currentBlockStartY = blockMaxY + 170;
    });

    // 大列之间通透舒适留白 280px
    const COLUMN_GAP = 280;
    globalColStartX = actualColMaxRightX + COLUMN_GAP;
  });

  return resultPositions;
}

/**
 * 遍历有向边，获取指定起始节点的所有下游节点 ID 集合 (BFS 拓扑传递)
 * 用于确保属性与标题变更仅精准向下游分支传播，杜绝跨生成器分支全局污染。
 */
export function getDownstreamNodeIds(
  startNodeId: string,
  edges: Array<{ source: string; target: string }>
): Set<string> {
  const downstream = new Set<string>();
  const queue = [startNodeId];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    edges.forEach((e) => {
      if (e.source === curr && !downstream.has(e.target)) {
        downstream.add(e.target);
        queue.push(e.target);
      }
    });
  }
  return downstream;
}
